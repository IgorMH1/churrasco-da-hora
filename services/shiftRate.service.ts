// services/shiftRate.service.ts
import { SCHEDULE_RULES } from "../config/constants";
import { CalculatedShiftRate, RoleParameterRule } from "../models/staff.model";
import { UserAccount } from "../models/user.model";

/**
 * Finds the matching role parameter rule for a user's specialty/function name (Card #41).
 */
export function findMatchingRoleRule(
  specialty: string | undefined,
  rules: RoleParameterRule[]
): RoleParameterRule | undefined {
  const normalizedSpecialty = (specialty || "").trim().toLowerCase();
  if (!normalizedSpecialty) return undefined;

  return rules.find((rule) => {
    const ruleName = rule.functionName.toLowerCase();
    const firstKeyword = ruleName.split(" ")[0];
    return (
      ruleName === normalizedSpecialty ||
      (firstKeyword && normalizedSpecialty.includes(firstKeyword))
    );
  });
}

/**
 * Calculates the applicable shift label and daily rate based on event start time (Card #41).
 */
export function calculateShiftRateForEvent(
  startTime: string,
  user: UserAccount | null,
  rules: RoleParameterRule[]
): CalculatedShiftRate {
  const startHour = Number((startTime || "12:00").split(":")[0]);
  const matchedRule = findMatchingRoleRule(user?.specialty, rules);

  const diurnaRate =
    user?.rateDiurna || matchedRule?.rateDiurna || user?.dailyRate || 250;
  const vespertinaRate =
    user?.rateVespertina || matchedRule?.rateVespertina || user?.dailyRate || 280;
  const noturnaRate =
    user?.rateNoturna || matchedRule?.rateNoturna || user?.dailyRate || 320;

  if (startHour < SCHEDULE_RULES.MORNING_SHIFT_END_HOUR) {
    return { shiftLabel: "Turno Diurno", rateValue: diurnaRate };
  }
  if (startHour < SCHEDULE_RULES.AFTERNOON_SHIFT_END_HOUR) {
    return { shiftLabel: "Turno Vespertino", rateValue: vespertinaRate };
  }
  return { shiftLabel: "Turno Noturno", rateValue: noturnaRate };
}