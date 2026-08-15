/** The words the price list needs, in one place for every page that uses it. */
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
    order: t("order.submit"),
  };
}
