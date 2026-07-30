const STORAGE_KEY = "premiere_booking_checkout_resume";

export type BookingCheckoutResume = {
  proId: string;
  selectedBookingDate: string | null;
  selectedBookingTime: string | null;
  serviceCategorySlug: string | null;
  serviceSlug: string | null;
  bookingTermsAccepted: boolean;
  bookingClientRenewAnnually: boolean;
};

export function saveBookingCheckoutResume(data: BookingCheckoutResume): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadBookingCheckoutResume(proId: string): BookingCheckoutResume | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingCheckoutResume;
    if (parsed?.proId !== proId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearBookingCheckoutResume(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function bookingCheckoutLoginPath(proId: string): string {
  const returnTo = `/pros/${proId}?resumeBooking=1`;
  return `/auth?mode=login&redirect=${encodeURIComponent(returnTo)}`;
}
