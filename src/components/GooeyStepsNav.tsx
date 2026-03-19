import "./GooeyStepsNav.css";

interface GooeyStepsNavProps {
  steps: string[];
}

export default function GooeyStepsNav({ steps }: GooeyStepsNavProps) {
  return (
    <div className="gooey-nav-container">
      <nav aria-label="How it works steps">
        <ul>
          {steps.map((label, index) => (
            <li key={label} className={index === 0 ? "active" : ""}>
              <a
                href="#how-it-works"
                onClick={(e) => {
                  e.preventDefault();
                }}
              >
                {index + 1}. {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

