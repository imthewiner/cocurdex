import { useState } from "react";
import { useMountEffect } from "@/lib";

export interface MountRequestState<T> {
  data: T | null;
  error: string;
}

export function useMountRequest<T>(
  request: () => Promise<T>,
): MountRequestState<T> {
  const [state, setState] = useState<MountRequestState<T>>({
    data: null,
    error: "",
  });
  useMountEffect(() => {
    let active = true;
    request().then(
      (data) => {
        if (active) setState({ data, error: "" });
      },
      (error) => {
        if (active) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  });
  return state;
}
