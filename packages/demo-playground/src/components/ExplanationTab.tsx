import React from "react";

interface ExplanationTabProps {
  explanation: string[];
}

export function ExplanationTab({ explanation }: ExplanationTabProps) {
  if (explanation.length === 0) {
    return <div className="no-data">No explanation available</div>;
  }

  return (
    <ul className="explanation-list">
      {explanation.map((line, i) => {
        const isWarning = line.toUpperCase().startsWith("WARNING");
        const isError = line.toLowerCase().startsWith("error");
        const isEmpty = line.trim() === "";

        if (isEmpty) return <li key={i}>&nbsp;</li>;

        return (
          <li
            key={i}
            className={isWarning ? "warning" : isError ? "error" : ""}
          >
            {line}
          </li>
        );
      })}
    </ul>
  );
}
