"use client";

import { useRef, useState, type PointerEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CreditCard,
  LockKeyhole,
  MoveHorizontal,
  ShoppingBag,
  Wifi,
} from "lucide-react";
import {
  demoCards,
  formatRand,
  type DemoTransaction,
} from "@/lib/demo-transactions";

export default function TransactionShowcase({
  onExplore,
}: {
  onExplore: (transaction: DemoTransaction) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(0);
  const [drag, setDrag] = useState(0);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const card = demoCards[index];
  const transaction = card.transactions[selected];
  const changeCard = (next: number) => {
    setIndex((next + demoCards.length) % demoCards.length);
    setSelected(0);
    setDrag(0);
  };
  const finishSwipe = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    const dx = event.clientX - gesture.current.x;
    const dy = event.clientY - gesture.current.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy))
      changeCard(index + (dx < 0 ? 1 : -1));
    gesture.current = null;
    setDrag(0);
  };

  return (
    <section
      className="section transactions-section"
      id="transactions"
      aria-labelledby="transactions-title"
    >
      <div className="container">
        <div className="section-heading reveal">
          <div>
            <div className="eyebrow">
              <span className="section-index">02 /</span> START WITH THE
              TRANSACTION
            </div>
            <h2 id="transactions-title">
              Your cards. Your activity.
              <br />
              <span>The full picture.</span>
            </h2>
          </div>
          <p>
            Swipe through the cards. Explore a payment. Follow its journey when
            something doesn’t look right.
          </p>
        </div>
        <div className="transaction-workspace reveal">
          <div className="wallet-panel">
            <div className="wallet-label">
              <span className="mono">YOUR WALLET</span>
              <span className="demo-tag">SAMPLE CARDS</span>
            </div>
            <div
              className="swipe-deck"
              role="region"
              aria-roledescription="carousel"
              aria-label="Sample payment cards"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  changeCard(index + (event.key === "ArrowRight" ? 1 : -1));
                }
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                gesture.current = { x: event.clientX, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (gesture.current)
                  setDrag(
                    Math.max(
                      -110,
                      Math.min(110, event.clientX - gesture.current.x),
                    ),
                  );
              }}
              onPointerUp={finishSwipe}
              onPointerCancel={() => {
                gesture.current = null;
                setDrag(0);
              }}
              onLostPointerCapture={() => {
                gesture.current = null;
                setDrag(0);
              }}
            >
              <div
                className="card-shadow card-shadow-back"
                aria-hidden="true"
              />
              <div
                className="card-shadow card-shadow-front"
                aria-hidden="true"
              />
              <div
                className={`payment-card ${card.tone} ${drag ? "is-dragging" : ""}`}
                key={index}
                style={{
                  transform: `translateX(${drag}px) rotate(${drag / 18}deg)`,
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${demoCards.length}: ${card.name} ${card.kind} card ending ${card.ending}`}
              >
                <div className="payment-card-orbit" aria-hidden="true" />
                <div className="payment-brand">
                  <span>
                    <img
                      src="/brand/disputeguard-logo.svg"
                      width="25"
                      height="25"
                      alt=""
                      draggable={false}
                    />
                    DisputeGuard
                  </span>
                  <Wifi size={22} />
                </div>
                <div className="card-chip" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="card-digits">
                  <span>••••</span>
                  <span>••••</span>
                  <span>••••</span>
                  <span>{card.ending}</span>
                </div>
                <div className="payment-card-bottom">
                  <div>
                    <small>DEMO CARD</small>
                    <strong>{card.name}</strong>
                  </div>
                  <span>
                    {card.kind}
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </div>
            </div>
            <div className="wallet-controls">
              <button
                className="round-control"
                aria-label="Previous card"
                onClick={() => changeCard(index - 1)}
              >
                <ArrowLeft size={17} />
              </button>
              <div className="wallet-dots" aria-label="Choose a card">
                {demoCards.map((item, i) => (
                  <button
                    key={item.name}
                    aria-label={`Show ${item.name} card`}
                    aria-pressed={i === index}
                    onClick={() => changeCard(i)}
                  >
                    <span />
                  </button>
                ))}
              </div>
              <button
                className="round-control"
                aria-label="Next card"
                onClick={() => changeCard(index + 1)}
              >
                <ArrowRight size={17} />
              </button>
            </div>
            <p className="swipe-hint">
              <MoveHorizontal size={14} /> Swipe, drag, or use the arrow keys
            </p>
            <div className="wallet-caption" aria-live="polite">
              <span>
                <CreditCard size={16} /> {card.name} · {card.ending}
              </span>
              <span>
                {index + 1} / {demoCards.length}
              </span>
            </div>
          </div>
          <div className="activity-panel">
            <div className="activity-heading">
              <div>
                <span className="eyebrow">
                  A LITTLE CONTEXT GOES A LONG WAY
                </span>
                <h3>Recent transactions</h3>
              </div>
              <span className="activity-period">OCT 2026</span>
            </div>
            <div
              className="transaction-list"
              aria-label={`${card.name} card transactions`}
            >
              {card.transactions.map((item, i) => (
                <button
                  key={item.id}
                  className={`transaction-row ${selected === i ? "selected" : ""}`}
                  onClick={() => setSelected(i)}
                  aria-pressed={selected === i}
                  aria-controls="transaction-detail"
                >
                  <span className="merchant-icon">
                    <ShoppingBag size={18} />
                  </span>
                  <span className="merchant-info">
                    <strong>{item.merchant}</strong>
                    <small>
                      {item.date} · {item.category}
                    </small>
                  </span>
                  <span className="merchant-value">
                    <strong>{formatRand(item.amountMinor)}</strong>
                    <small
                      className={item.status === "Pending" ? "pending" : ""}
                    >
                      {item.status}
                    </small>
                  </span>
                  <span className="row-selector" aria-hidden="true">
                    {selected === i && <Check size={11} />}
                  </span>
                </button>
              ))}
            </div>
            <div
              className="transaction-detail"
              id="transaction-detail"
              aria-live="polite"
            >
              <div className="detail-meta">
                <span className="mono">{transaction.id}</span>
                <span>
                  <LockKeyhole size={11} /> SAMPLE DATA
                </span>
              </div>
              <h4>
                {transaction.status === "Pending"
                  ? "Still processing."
                  : "Something doesn’t look right?"}
              </h4>
              <p>{transaction.reason}</p>
              {transaction.status === "Pending" ? (
                <span className="pending-explanation">
                  This demo lets you explore disputes for completed payments.
                  Choose another transaction to continue.
                </span>
              ) : (
                <a
                  className="transaction-cta"
                  href="#workflow"
                  onClick={() => onExplore(transaction)}
                >
                  See this dispute journey <ArrowRight size={16} />
                </a>
              )}
            </div>
          </div>
        </div>
        <p className="section-disclaimer">
          Illustrative cards and transactions. Selecting a payment explores the
          demo; no dispute is submitted.
        </p>
      </div>
    </section>
  );
}
