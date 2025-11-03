import React from "react";

const layout = ({ children }: { children: React.ReactNode }) => {
  return <div className="bg-slate-900">{children}</div>;
};

export default layout;
