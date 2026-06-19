import { AntiCheatContext, AntiCheatValidator, AntiCheatCheckResult } from './types';
import { AppError, ErrorCode } from '@/lib/api/errors';
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
        ctx.violations = [];

        for (const validator of this.validators) {
            const result = await validator.validate(ctx);
            
            // Merge computed data outputs into context
            if (result.computedData) {
                if (result.computedData.finalPolygons !== undefined) {
                    ctx.finalPolygons = result.computedData.finalPolygons;
                }
                if (result.computedData.accurateAreaKm2 !== undefined) {
                    ctx.accurateAreaKm2 = result.computedData.accurateAreaKm2;
                }
                if (result.computedData.diagData !== undefined) {
                    ctx.diagData = result.computedData.diagData;
                }
            }

            // Testers bypass fatal flags but still log
            const isEffectivelyFatal = result.isFatal && !ctx.isTester;

            if (!result.passed) {
                if (result.cheatFlag) {
                    cheatFlags.push(result.cheatFlag);
                }
                totalRisk += result.riskScore;

                const violation = {
                    user_id: ctx.userId,
                    risk_score: result.riskScore,
                    cheat_flags: { flag: result.cheatFlag, validator: validator.name, testerBypass: ctx.isTester },
                    raw_payload: ctx.runData as any,
                    action_taken: isEffectivelyFatal ? 'BLOCKED_AND_THROWN' : 'FLAGGED'
                };
                ctx.violations.push(violation);

                if (isEffectivelyFatal) {
                    // Fatal block: Run won't be saved, write log immediately as fire-and-forget
                    prisma.anti_cheat_audit_logs.create({
                        data: {
                            ...violation,
                            run_id: undefined
                        }
                    }).catch(err => {
                        console.error('[Anti-Cheat Pipeline] Failed to write fatal audit log:', err);
                    });

                    const errorMsg = `Anti-cheat violation: ${result.cheatFlag || validator.name}`;
                    console.warn(`[Anti-Cheat Pipeline] Fatal block for user ${ctx.userId}: ${errorMsg}`);
                    throw new AppError(result.errorCode || ErrorCode.CHEAT_GENERAL_VIOLATION, errorMsg);
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
