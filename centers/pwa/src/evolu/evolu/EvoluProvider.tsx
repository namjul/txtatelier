import type { Component, JSX } from "solid-js";
import { EvoluContext } from "./EvoluContext";

export const EvoluProvider: Component<{
  children?: JSX.Element | undefined;
  value: unknown;
}> = (props): JSX.Element => {
  return (
    <EvoluContext.Provider value={props.value}>
      {props.children}
    </EvoluContext.Provider>
  );
};
