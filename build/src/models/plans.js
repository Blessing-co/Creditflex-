/* MODEL: payment plans (daily, weekly ...). */
const Plans = {
  all: () => cfRead("reg:plans", () => sb.from("payment_plans").select("id,name,frequency,installments").order("id"))
};
