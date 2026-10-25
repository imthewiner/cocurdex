import type { ReactNode } from "react";

export interface FormProps {
  children: ReactNode;
}

export interface FormSectionProps {
  title?: string;
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}
