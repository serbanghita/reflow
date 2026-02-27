import React from "react";

interface ErrorsTabProps {
  errors: string[];
}

export function ErrorsTab({ errors }: ErrorsTabProps) {
  if (errors.length === 0) {
    return <div className="no-data">No errors</div>;
  }

  return (
    <ul className="error-list">
      {errors.map((err, i) => (
        <li key={i}>
          <span className="error-icon">!</span>
          <span>{err}</span>
        </li>
      ))}
    </ul>
  );
}
