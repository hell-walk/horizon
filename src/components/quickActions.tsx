import { ArrowLeftRight, FileUp, PlugZap } from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  { index: "01", label: "Transfer funds", href: "/payment-transfer", icon: ArrowLeftRight },
  { index: "02", label: "Connect a bank", href: "/connect-bank", icon: PlugZap },
  { index: "03", label: "Import statement", href: "/connect-bank#statement", icon: FileUp },
];

// Three shortcut cards under the Home header.
const QuickActions = () => (
  <div className="grid gap-3 sm:grid-cols-3">
    {ACTIONS.map((action) => {
      const Icon = action.icon;
      return (
        <Link
          key={action.href}
          href={action.href}
          className="group flex items-center justify-between rounded-lg border border-line bg-card px-4 py-3 transition-colors hover:border-primary"
        >
          <span className="flex flex-col gap-1">
            <span className="eyebrow">Action {"// "}{action.index}</span>
            <span className="text-14 font-semibold text-ink">{action.label}</span>
          </span>
          <span className="flex-center size-9 rounded-md bg-surface-container text-ink-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-4" />
          </span>
        </Link>
      );
    })}
  </div>
);

export default QuickActions;
