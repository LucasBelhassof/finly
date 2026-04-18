import { useContext } from "react";

import { ProductTourContext } from "@/modules/product-tour/ProductTourProvider";

export function useProductTour() {
  const context = useContext(ProductTourContext);

  if (!context) {
    throw new Error("useProductTour must be used inside ProductTourProvider.");
  }

  return context;
}
