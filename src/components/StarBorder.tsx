import "./StarBorder.css";

interface StarBorderProps {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  innerClassName?: string;
  color?: string;
  speed?: string;
  thickness?: number;
  children: React.ReactNode;
  [key: string]: unknown;
}

export default function StarBorder({
  as: Component = "div",
  className = "",
  innerClassName = "",
  color = "white",
  speed = "6s",
  thickness = 1,
  children,
  ...rest
}: StarBorderProps) {
  return (
    <Component
      className={`star-border-container ${className}`.trim()}
      style={{ padding: `${thickness}px 0` }}
      {...rest}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div className={`star-border-inner-content ${innerClassName}`.trim()}>{children}</div>
    </Component>
  );
}
