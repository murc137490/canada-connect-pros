import StorageDisplayImage from "@/components/StorageDisplayImage";

type Props = {
  bucket: string;
  url: string | null | undefined;
  alt: string;
  className?: string;
};

export default function AdminReviewPhoto(props: Props) {
  return <StorageDisplayImage {...props} />;
}
