// src/app/api/healthz/route.ts
import { NextResponse } from "next/server";
import { getNowGmt3, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES, PASSWORD_MAX_AGE_DAYS } from "../../../lib/services/rbacAndTime";
import { ANATEL_VALID_DDDS } from "../../../lib/services/anatel";

export async function GET() {
  const nowGmt3 = getNowGmt3();

  return NextResponse.json({
    status: "ok",
    system: "Churrasco dos Da Hora",
    version: "1.0.0",
    serverTimeGmt3: nowGmt3.formattedPtBr,
    timezone: "America/Sao_Paulo (GMT-3)",
    activeRules: {
      anatelValidDddsCount: Object.keys(ANATEL_VALID_DDDS).length,
      rbacMaxLoginAttempts: MAX_LOGIN_ATTEMPTS,
      rbacLockoutMinutes: LOCKOUT_MINUTES,
      rbacPasswordMaxAgeDays: PASSWORD_MAX_AGE_DAYS,
    },
  });
}