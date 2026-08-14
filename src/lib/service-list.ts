/** The six words the price list needs, in one place for both pages that use it. */
export function serviceListLabels(t: (key: string) => string): Record<string, string> {
  return {
    id: t("service.id"),
    service: t("order.service"),
    rate: t("order.rate"),
    min: t("order.min"),
    max: t("order.max"),
    status: t("common.status"),
    refill: t("service.refill"),
    standard: t("service.standard"),
  };
}
