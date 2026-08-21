import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import ProPlanCheckoutExperience, { type ProPlanCheckoutExperienceProps } from "./ProPlanCheckoutExperience";

export type ProPlanCheckoutModalProps = Omit<ProPlanCheckoutExperienceProps, "embedded" | "onCancel"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ProPlanCheckoutModal({
  open,
  onOpenChange,
  onSuccess,
  ...rest
}: ProPlanCheckoutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(92vh,calc(100%-1.5rem))] gap-0 overflow-y-auto overflow-x-hidden border-neutral-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-[#0a0a0a] sm:max-w-lg",
          "[&>button]:text-neutral-600 hover:[&>button]:text-neutral-950 dark:[&>button]:text-neutral-400 dark:hover:[&>button]:text-neutral-100"
        )}
      >
        <DialogTitle className="sr-only">{rest.strings.title}</DialogTitle>
        <DialogDescription className="sr-only">{rest.strings.description}</DialogDescription>
        <ProPlanCheckoutExperience
          {...rest}
          embedded
          onCancel={() => onOpenChange(false)}
          onSuccess={() => {
            onSuccess();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
