import type { OrderLabels } from "@/components/orders/new-order-form";

/**
 * Every word the order form needs, in one place.
 *
 * Two pages render that form now — the dashboard's and each category's — and
 * a label list copied into both would drift the first time one of them gained
 * a field. The form's own type is the check: add a key there and this stops
 * compiling until it is translated.
 */
export function orderFormLabels(t: (key: string) => string): OrderLabels {
  return {
    platform: t("order.platform"),
    category: t("order.category"),
    service: t("order.service"),
    link: t("order.link"),
    quantity: t("order.quantity"),
    charge: t("order.charge"),
    submit: t("order.submit"),
    min: t("order.min"),
    max: t("order.max"),
    rate: t("order.rate"),
    comments: t("order.comments"),
    commentsHint: t("order.commentsHint"),
    username: t("order.username"),
    usernameHint: t("order.usernameHint"),
    posts: t("order.posts"),
    postsHint: t("order.postsHint"),
    perPost: t("order.perPost"),
    delay: t("order.delay"),
    delayHint: t("order.delayHint"),
    expiry: t("order.expiry"),
    expiryHint: t("order.expiryHint"),
    minutes: t("order.minutes"),
    balance: t("common.balance"),
    addFunds: t("dash.addFunds"),
    selectCategory: t("order.selectCategory"),
    selectService: t("order.selectService"),
    id: t("order.id"),
    limits: t("order.limits"),
    selectPlatform: t("order.selectPlatform"),
    quickFind: t("order.quickFind"),
    quickFindHint: t("order.quickFindHint"),
    quickFindPlaceholder: t("order.quickFindPlaceholder"),
    factTime: t("order.factTime"),
    factSpeed: t("order.factSpeed"),
    perDay: t("order.perDay"),
    factUnknown: t("order.factUnknown"),
    factCancel: t("order.factCancel"),
    factWarranty: t("order.factWarranty"),
    factYes: t("order.factYes"),
    factNo: t("order.factNo"),
    listPrice: t("order.listPrice"),
    selectPlatformFirst: t("order.selectPlatformFirst"),
    selectCategoryFirst: t("order.selectCategoryFirst"),
    searchService: t("common.search"),
    noResults: t("common.none"),
    averageTime: t("order.averageTime"),
    refillLabel: t("order.refill"),
    cancelLabel: t("order.cancel"),
    yes: t("common.yes"),
    no: t("common.no"),
    placed: t("order.placed"),
    track: t("order.track"),
    insufficient: t("order.insufficient"),
    dripfeed: t("order.dripfeed"),
    runs: t("order.runs"),
    interval: t("order.interval"),
    intervalHint: t("order.intervalHint"),
    total: t("order.totalQuantity"),
    // Templates: the form fills {n} with the operator's figure.
    minutesN: t("time.minutes"),
    daysN: t("time.days"),
  };
}
