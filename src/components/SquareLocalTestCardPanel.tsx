import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  matchesLocalSquareTestCredentials,
  SQUARE_LOCAL_TEST_CVV,
  SQUARE_LOCAL_TEST_PAN_DIGITS,
  showSquareLocalTestPanel,
} from "@/lib/squareLocalTestCard";

type SquareLocalTestCardPanelProps = {
  /** Called when PAN/CVV/exp match the local test credentials; must not call Square charge APIs. */
  onBypass: () => void;
};

/**
 * Dev-only: Square Web Payments iframes never expose full card numbers to the host app,
 * so we cannot detect the test PAN inside Square’s fields. This panel replicates the test
 * values for local flows that should skip `square-create-payment`.
 */
export default function SquareLocalTestCardPanel({ onBypass }: SquareLocalTestCardPanelProps) {
  const [pan, setPan] = useState(SQUARE_LOCAL_TEST_PAN_DIGITS);
  const [cvv, setCvv] = useState(SQUARE_LOCAL_TEST_CVV);
  const [exp, setExp] = useState("01/27");
  const [err, setErr] = useState<string | null>(null);

  if (!showSquareLocalTestPanel()) return null;

  const submit = () => {
    if (!matchesLocalSquareTestCredentials(pan, cvv, exp)) {
      setErr("Use PAN 314159265358979, CVV 111, exp 01/27 for the local test bypass.");
      return;
    }
    setErr(null);
    onBypass();
  };

  return (
    <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-foreground dark:text-amber-50/95">
      <p className="font-semibold text-amber-950 dark:text-amber-100">Development: local test card (no Square charge)</p>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-100/85">
        Square’s card fields do not expose numbers to this app. Enter the test card here to complete the same success step
        without calling the payment Edge Function.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="sq-local-pan" className="text-[10px] uppercase tracking-wide">
            Card number
          </Label>
          <Input
            id="sq-local-pan"
            inputMode="numeric"
            autoComplete="off"
            className="h-9 font-mono text-xs bg-white dark:bg-background"
            value={pan}
            onChange={(e) => setPan(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sq-local-exp" className="text-[10px] uppercase tracking-wide">
            Exp
          </Label>
          <Input
            id="sq-local-exp"
            placeholder="01/27"
            className="h-9 font-mono text-xs bg-white dark:bg-background"
            value={exp}
            onChange={(e) => setExp(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sq-local-cvv" className="text-[10px] uppercase tracking-wide">
            CVV
          </Label>
          <Input
            id="sq-local-cvv"
            inputMode="numeric"
            className="h-9 font-mono text-xs bg-white dark:bg-background"
            value={cvv}
            onChange={(e) => setCvv(e.target.value)}
          />
        </div>
      </div>
      {err ? <p className="mt-2 text-[11px] text-destructive">{err}</p> : null}
      <Button type="button" variant="secondary" size="sm" className="mt-3 w-full sm:w-auto" onClick={submit}>
        Complete as local test (skip Square charge)
      </Button>
    </div>
  );
}
