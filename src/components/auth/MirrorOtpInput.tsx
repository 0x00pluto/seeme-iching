import React, { useEffect, useRef } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

const slotClassName = cn(
  "size-12 rounded-xl border-ink/15 bg-white/70 font-serif text-xl text-ink shadow-sm",
  "first:rounded-xl first:border-l last:rounded-xl",
  "data-[active=true]:border-ink/40 data-[active=true]:ring-2 data-[active=true]:ring-ink/10"
);

export interface MirrorOtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (digits: string) => void;
  disabled?: boolean;
  id?: string;
}

export const MirrorOtpInput: React.FC<MirrorOtpInputProps> = ({
  value,
  onChange,
  onComplete,
  disabled,
  id = "mirror-otp",
}) => {
  const lastCompleted = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === 6 && /^\d{6}$/.test(value) && lastCompleted.current !== value) {
      lastCompleted.current = value;
      onComplete(value);
    }
    if (value.length < 6) {
      lastCompleted.current = null;
    }
  }, [value, onComplete]);

  return (
    <div className="flex flex-col items-center gap-2">
      <label htmlFor={id} className="sr-only">
        照见信中之码
      </label>
      <InputOTP
        id={id}
        maxLength={6}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={onChange}
        disabled={disabled}
        containerClassName="justify-center gap-3"
      >
        <InputOTPGroup className="gap-2 border-0 shadow-none">
          <InputOTPSlot index={0} className={slotClassName} />
          <InputOTPSlot index={1} className={slotClassName} />
          <InputOTPSlot index={2} className={slotClassName} />
        </InputOTPGroup>
        <InputOTPSeparator className="text-ink/25" />
        <InputOTPGroup className="gap-2 border-0 shadow-none">
          <InputOTPSlot index={3} className={slotClassName} />
          <InputOTPSlot index={4} className={slotClassName} />
          <InputOTPSlot index={5} className={slotClassName} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
};
