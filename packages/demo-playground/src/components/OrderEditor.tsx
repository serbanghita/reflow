import React, { useState } from "react";
import type { TradeOrder } from "../types";

interface OrderEditorProps {
  orders: TradeOrder[];
}

export function OrderEditor({ orders }: OrderEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="sidebar-section">
      <h3>Trade Orders</h3>
      <ul className="data-tree">
        {orders.map((order) => {
          const isOpen = expandedId === order.docId;
          const d = order.data;

          return (
            <li key={order.docId} className="data-tree-item">
              <div
                className="data-tree-header"
                onClick={() =>
                  setExpandedId(isOpen ? null : order.docId)
                }
              >
                <span
                  className={`data-tree-toggle ${isOpen ? "open" : ""}`}
                >
                  ▶
                </span>
                <span>
                  {d.tradeOrderNumber} ({d.instrumentId})
                </span>
              </div>
              {isOpen && (
                <div className="data-tree-body">
                  <div className="field">
                    <span className="key">Instrument</span>
                    <span className="val">{d.instrumentId}</span>
                  </div>
                  <div className="field">
                    <span className="key">Quantity</span>
                    <span className="val">{d.quantity}</span>
                  </div>
                  <div className="field">
                    <span className="key">Settlement Date</span>
                    <span className="val">{d.settlementDate}</span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
