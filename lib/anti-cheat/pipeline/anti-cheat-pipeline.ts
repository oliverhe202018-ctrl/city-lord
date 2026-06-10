import { AntiCheatContext, AntiCheatValidator, AntiCheatCheckResult } from './types';
import { AppError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

export class AntiCheatPipeline {
    private validators: AntiCheatValidator[] = [];

    constructor(validators: AntiCheatValidator[] = []) {
        this.validators = validators;
    }

    add(validator: AntiCheatValidator): this {
        this.validators.push(validator);
        return this;
    }

    async execute(ctx: AntiCheatContext): Promise<{ passed: boolean; cheatFlags: string[]; totalRisk: number }> {
        let totalRisk = 0;
        const cheatFlags: string[] = [];

        for (const validator of this.validators) {
            const result = await validator.validate(ctx);
            
            // Testers bypass fatal flags but still log
            const isEffectivelyFatal = result.isFatal && !ctx.isTester;

            if (!result.passed) {
                if (result.cheatFlag) {
                    cheatFlags.push(result.cheatFlag);
                }
                totalRisk += result.riskScore;

                // Log violations to database
                await prisma.anti_cheat_audit_logs.create({
                    data: {
                        user_id: ctx.userId,
                        run_id: undefined, // Run might not be created yet, or can be patched later
                        risk_score: result.riskScore,
                        cheat_flags: { flag: result.cheatFlag, validator: validator.name, testerBypass: ctx.isTester },
                        raw_payload: ctx.runData as any,
                        action_taken: isEffectivelyFatal ? 'BLOCKED_AND_THROWN' : 'FLAGGED'
                    }
                });

                if (isEffectivelyFatal) {
                    const errorMsg = `Anti-cheat violation: ${result.cheatFlag || validator.name}`;
                    console.warn(`[Anti-Cheat Pipeline] Fatal block for user ${ctx.userId}: ${errorMsg}`);
                    if (result.errorCode) {
                        throw new AppError(result.errorCode, errorMsg);
                    } else {
                        // Fallback generic business error
                        throw new AppError('BIZ_VALIDATION_FAILED' as any, errorMsg);
                    }
                }
            }
        }

        return { 
            passed: ctx.isTester || totalRisk < 100, 
            cheatFlags, 
            totalRisk 
        };
    }
}
