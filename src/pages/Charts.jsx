import React from "react";
import ChartPanel from "../components/ChartPanel";
import Checklist from "../components/Checklist";

export default function Charts() {
  return (
    <div className="space-y-4">
      <ChartPanel tall />
      <Checklist />
    </div>
  );
}
