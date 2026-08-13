"use client";

import { useState, useTransition } from "react";
import { withdrawEarningsAction } from "@/app/actions/affiliate";
import { Icon } from "@/components/icons";

export default function WithdrawButton({ label, disabled }: { label: string; disabled: boolean }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          setError("");
          start(async () => {
            const result = await withdrawEarningsAction();
            if (result.error) setError(result.error);
          });
        }}
        className="btn btn-primary btn-sm"
      >
        <Icon name="wallet" size={15} />
        {label}
      </button>
      {error && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={14} />
          <span>{error}</span>
        </p>
      )}
    </>
  );
}
