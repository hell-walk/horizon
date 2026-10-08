import Link from "next/link";

// Footer for the public pages: legal links and the copyright line.
const SiteFooter = () => (
  <footer className="text-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-6 py-4 text-gray-500">
    <span>&copy; {new Date().getFullYear()} Horizon</span>
    <Link href="/privacy" className="hover:text-gray-700">
      Privacy policy
    </Link>
    <Link href="/terms" className="hover:text-gray-700">
      Terms &amp; conditions
    </Link>
    <a href="mailto:support@horizon.app" className="hover:text-gray-700">
      support@horizon.app
    </a>
  </footer>
);

export default SiteFooter;
