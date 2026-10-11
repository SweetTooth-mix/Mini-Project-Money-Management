"use client";
import { useEffect, useRef } from "react";
export function Disclosure({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const open = () => {
      if (location.hash === `#${id}` && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView({ block: "start" });
      }
    };
    const click = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(`a[href="#${id}"]`) &&
        ref.current
      )
        ref.current.open = true;
    };
    open();
    window.addEventListener("hashchange", open);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("hashchange", open);
      document.removeEventListener("click", click);
    };
  }, [id]);
  return (
    <details className="form-disclosure" id={id} ref={ref}>
      <summary>
        <span>
          {title}
          <small>{description}</small>
        </span>
        <span className="plus-mark">+</span>
      </summary>
      {children}
    </details>
  );
}
