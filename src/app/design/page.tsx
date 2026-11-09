import type { Metadata } from "next";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Système de design", robots: { index: false } };

export default function DesignPage() {
  return <Showcase />;
}
