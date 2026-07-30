import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog as DialogPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogFooter as DialogFooterPrimitive,
  DialogHeader as DialogHeaderPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  type DialogContentProps as DialogContentPrimitiveProps,
} from "@/components/animate-ui/primitives/radix/dialog";

export type DialogContentProps = DialogContentPrimitiveProps & {
  showCloseButton?: boolean;
};

function DialogContent({ className, children, showCloseButton = true, ...props }: DialogContentProps) {
  return (
    <DialogContentPrimitive className={cn("sm:max-w-[425px]", className)} {...props}>
      {children}
      {showCloseButton ? (
        <DialogClosePrimitive className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-muted/80 opacity-90 transition-opacity hover:opacity-100 hover:bg-muted focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClosePrimitive>
      ) : null}
    </DialogContentPrimitive>
  );
}

const Dialog = DialogPrimitive;
const DialogTrigger = DialogTriggerPrimitive;
const DialogClose = DialogClosePrimitive;
const DialogHeader = DialogHeaderPrimitive;
const DialogFooter = DialogFooterPrimitive;
const DialogTitle = DialogTitlePrimitive;
const DialogDescription = DialogDescriptionPrimitive;

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
