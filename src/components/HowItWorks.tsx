import { Search, Users, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Tell Us What You Need",
  },
  {
    icon: Users,
    title: "Get Matched with Pros",
  },
  {
    icon: CheckCircle,
    title: "Hire with Confidence",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-4">
            How It Works
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <div key={i} className="text-center scroll-fade-in">
              <div className="glass-card glass-hover w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <step.icon size={36} className="text-secondary" />
              </div>
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10 text-secondary text-sm font-bold mb-4">
                {i + 1}
              </div>
              <h3 className="font-heading font-bold text-xl text-foreground">{step.title}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
