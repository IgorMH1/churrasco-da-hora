// components/shared/PasswordRbacChecklist.tsx
"use client";

import React from "react";
import { RBAC_SECURITY_LIMITS } from "../../config/constants";

export interface PasswordRbacChecklistProps {
  passwordValue: string;
}

export interface PasswordCriteriaEvaluation {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  isAllValid: boolean;
}

/**
 * Evaluates a password string against the 4 RBAC security requirements.
 */
export function evaluatePasswordRbacCriteria(
  password: string
): PasswordCriteriaEvaluation {
  const hasMinLength = password.length >= RBAC_SECURITY_LIMITS.MIN_PASSWORD_LENGTH;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  return {
    hasMinLength,
    hasUppercase,
    hasNumber,
    hasSpecialChar,
    isAllValid: hasMinLength && hasUppercase && hasNumber && hasSpecialChar,
  };
}

/**
 * Visual real-time checklist for the 4 RBAC password complexity rules.
 */
export function PasswordRbacChecklist({
  passwordValue,
}: PasswordRbacChecklistProps) {
  const evaluation = evaluatePasswordRbacCriteria(passwordValue);

  const items = [
    { label: "Mínimo 8 caracteres", passed: evaluation.hasMinLength },
    { label: "Letra maiúscula (A-Z)", passed: evaluation.hasUppercase },
    { label: "Número (0-9)", passed: evaluation.hasNumber },
    { label: "Caractere especial (!@#$)", passed: evaluation.hasSpecialChar },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 pt-1">
      {items.map((item) => (
        <div
          key={item.label}
          className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-semibold ${
            item.passed
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-slate-900/70 border-slate-800 text-slate-400"
          }`}
        >
          <span>{item.passed ? "✓" : "○"}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}