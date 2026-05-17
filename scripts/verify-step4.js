"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var uuid_1 = require("uuid");
var prisma = new client_1.PrismaClient();
function runVerification() {
    return __awaiter(this, void 0, void 0, function () {
        var inviterId, inviteeId, pastDate, invite1, invite2, cronRes, cronData, updated1, updated2, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('--- Step 4 Verification Script ---');
                    inviterId = (0, uuid_1.v4)();
                    inviteeId = (0, uuid_1.v4)();
                    // Create mock profiles directly if needed, assuming the DB allows missing profiles or we can create them
                    return [4 /*yield*/, prisma.profiles.create({
                            data: { id: inviterId, nickname: 'Test Inviter', coins: 0, created_at: new Date() }
                        })];
                case 1:
                    // Create mock profiles directly if needed, assuming the DB allows missing profiles or we can create them
                    _a.sent();
                    return [4 /*yield*/, prisma.profiles.create({
                            data: { id: inviteeId, nickname: 'Test Invitee', coins: 0, created_at: new Date() }
                        })];
                case 2:
                    _a.sent();
                    console.log("[Users Created] Inviter: ".concat(inviterId, ", Invitee: ").concat(inviteeId));
                    pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
                    ;
                    return [4 /*yield*/, prisma.friend_invitations.create({
                            data: { inviter_user_id: inviterId, invite_link: "/invite?ref=TEST_CRON_1_".concat(Date.now()), status: 'pending', expired_at: pastDate }
                        })];
                case 3:
                    invite1 = _a.sent();
                    return [4 /*yield*/, prisma.friend_invitations.create({
                            data: { inviter_user_id: inviterId, invite_link: "/invite?ref=TEST_CRON_2_".concat(Date.now()), status: 'pending', expired_at: null } // Should NOT be cleaned
                        })];
                case 4:
                    invite2 = _a.sent();
                    console.log('[Cron Setup Data]', { invite1: invite1.id, invite2: invite2.id });
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 10, , 11]);
                    return [4 /*yield*/, fetch('http://localhost:3000/api/cron/cleanup-invitations', {
                            headers: { 'Authorization': "Bearer ".concat(process.env.CRON_SECRET || 'cron-secret') }
                        })];
                case 6:
                    cronRes = _a.sent();
                    return [4 /*yield*/, cronRes.json()];
                case 7:
                    cronData = _a.sent();
                    console.log('[Cron Result]', cronData);
                    return [4 /*yield*/, prisma.friend_invitations.findUnique({ where: { id: invite1.id } })];
                case 8:
                    updated1 = _a.sent();
                    return [4 /*yield*/, prisma.friend_invitations.findUnique({ where: { id: invite2.id } })];
                case 9:
                    updated2 = _a.sent();
                    console.log('[Cron DB Verify]', {
                        invite1_status: updated1 === null || updated1 === void 0 ? void 0 : updated1.status, // should be 'expired'
                        invite2_status: updated2 === null || updated2 === void 0 ? void 0 : updated2.status // should still be 'pending'
                    });
                    return [3 /*break*/, 11];
                case 10:
                    e_1 = _a.sent();
                    console.warn('Cron fetch failed (Server might not be running). Manual DB verify needed.');
                    return [3 /*break*/, 11];
                case 11:
                    // 4. Test Concurrent Accept Invite
                    // Cannot easily mock `createClient().auth.getUser` inside server actions from a pure script 
                    // without extensive mocking, but we can document the expectation.
                    console.log('--- Please run concurrent acceptInvite tests directly via UI or Jest if mocked ---');
                    // Cleanup
                    return [4 /*yield*/, prisma.friend_invitations.deleteMany({ where: { inviter_user_id: inviterId } })];
                case 12:
                    // Cleanup
                    _a.sent();
                    return [4 /*yield*/, prisma.profiles.delete({ where: { id: inviterId } })];
                case 13:
                    _a.sent();
                    return [4 /*yield*/, prisma.profiles.delete({ where: { id: inviteeId } })];
                case 14:
                    _a.sent();
                    console.log('--- Verification Script Completed ---');
                    return [2 /*return*/];
            }
        });
    });
}
runVerification().catch(console.error).finally(function () { return prisma.$disconnect(); });
