// components/shared/StatusBadge.tsx
"use client";

import React from "react";
import {
  EVENT_STATUS_BADGE_TOKENS,
  USER_STATUS_BADGE_TOKENS,
} from "../../config/themeTokens";
import { EventStatus } from "../../models/event.model";
import { UserStatus } from "../../models/user.model";

export interface EventStatusBadgeProps {
  status: EventStatus;
}

export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const tokenClasses =
    EVENT_STATUS_BADGE_TOKENS[status] || EVENT_STATUS_BADGE_TOKENS.PENDENTE;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${tokenClasses}`}
    >
      {status}
    </span>
  );
}

export interface UserStatusBadgeProps {
  status: UserStatus;
}

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const tokenClasses =
    USER_STATUS_BADGE_TOKENS[status] || USER_STATUS_BADGE_TOKENS.ATIVO;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${tokenClasses}`}
    >
      {status}
    </span>
  );
}