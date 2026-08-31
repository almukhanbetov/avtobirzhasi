// Only the persistent site chrome (header/footer/nav) is translated so
// far — everything else (catalog, dashboard, forms) is still Russian-only.
// Add more keys here as more of the site gets translated; see
// lib/i18n/LanguageProvider.tsx for how `t()` falls back to the key
// itself (and logs a warning) if a translation is missing, so a partially
// translated page never silently shows blank text.
export const translations = {
  ru: {
    "nav.cars": "Автомобили",
    "nav.buy": "Купить",
    "nav.sell": "Продать",
    "nav.exchange": "Автобиржа",
    "nav.howItWorks": "Как это работает",

    "header.favorites": "Избранное",
    "header.login": "Войти",
    "header.dashboard": "Личный кабинет",
    "header.adminPanel": "Админ-панель",
    "header.logout": "Выйти",
    "header.postAd": "Подать объявление",
    "header.openMenu": "Открыть меню",
    "header.closeMenu": "Закрыть меню",

    "theme.toDark": "Включить тёмную тему",
    "theme.toLight": "Включить светлую тему",
    "theme.dark": "Тёмная тема",
    "theme.light": "Светлая тема",

    "footer.tagline":
      "Автомобильная биржа Казахстана. Покупайте и продавайте по цене, которая устраивает обе стороны.",
    "footer.buyers": "Покупателям",
    "footer.allCars": "Все автомобили",
    "footer.buyNow": "Купить сейчас",
    "footer.buyViaExchange": "Купить через Автобиржу",
    "footer.favorites": "Избранное",
    "footer.sellers": "Продавцам",
    "footer.postAd": "Подать объявление",
    "footer.howToSellFaster": "Как продать быстрее",
    "footer.howItWorks": "Как это работает",
    "footer.company": "Компания",
    "footer.about": "О нас",
    "footer.safety": "Безопасность сделок",
    "footer.contacts": "Контакты",
    "footer.rights": "© 2026 AVTOBIRZHASI.KZ. Все права защищены.",
    "footer.country": "Казахстан",

    "specs.title": "Характеристики",
    "specs.year": "Год",
    "specs.mileage": "Пробег",
    "specs.engine": "Двигатель",
    "specs.transmission": "Коробка",
    "specs.drivetrain": "Привод",
    "specs.bodyType": "Кузов",
    "specs.color": "Цвет",
    "specs.steeringWheel": "Руль",

    "description.title": "Описание",
    "description.empty": "Продавец не добавил описание к этому объявлению.",

    "filters.from": "от",
    "filters.to": "до",
    "filters.yearSuffix": "г.",
    "filters.resetAll": "Сбросить всё",

    "notification.unread": "Непрочитано",

    "match.finalPrice": "Финальная цена",
    "match.yourDeposit": "Ваш депозит",
    "match.deadline": "Дедлайн",
    "match.sellerDeposit": "Депозит продавца:",
    "match.buyerDeposit": "Депозит покупателя:",
    "match.paid": "внесён",
    "match.pending": "ожидается",
    "match.payDeposit": "Внести депозит",
    "match.contactsOpen": "Контакты открыты →",
    "match.viewSimilar": "Смотреть похожие",

    "row.updated": "Обновлено",
    "row.open": "Открыть",
    "row.actions": "Действия",
    "row.editListing": "Редактировать",
    "row.pay": "Оплатить",
    "row.paying": "Оплата…",
    "row.details": "Подробнее",
    "row.edit": "Изменить",
    "row.save": "Сохранить",
    "row.saving": "Сохранение…",
    "row.cancelEdit": "Отмена",
    "row.delete": "Удалить",
    "row.deleting": "Удаление…",
    "row.deleteConfirm": "Удалить это объявление? Действие нельзя отменить.",
    "row.cancelRequest": "Отменить заявку",
    "row.cancelingRequest": "Отмена…",
    "row.cancelRequestConfirm": "Отменить эту заявку? Действие нельзя отменить.",
    "row.exchangePriceLocked": "Цена управляется автообменом и меняется автоматически",

    "home.hero.eyebrow": "Автомобильная биржа Казахстана",
    "home.hero.title": "Найдите автомобиль по вашей цене",
    "home.hero.description":
      "Не ждите случайного звонка. Автобиржа автоматически сведёт покупателя и продавца, когда условия и цены совпадут.",
    "home.hero.buyCta": "Купить автомобиль",
    "home.hero.sellCta": "Продать автомобиль",
    "home.hero.imageAlt": "Премиальный автомобиль",

    "quickSearch.region": "Регион",
    "quickSearch.anyRegion": "Любой регион",
    "quickSearch.make": "Марка",
    "quickSearch.anyMake": "Любая марка",
    "quickSearch.model": "Модель",
    "quickSearch.anyModel": "Любая модель",
    "quickSearch.year": "Год",
    "quickSearch.anyYear": "Любой",
    "quickSearch.price": "Цена",
    "quickSearch.anyPrice": "Любая цена",
    "quickSearch.submit": "Найти",

    "home.whyUs.eyebrow": "Почему AVTOBIRZHASI",
    "home.whyUs.title": "Преимущества платформы",
    "home.whyUs.benefit1.title": "Автоматический подбор",
    "home.whyUs.benefit1.description":
      "Не нужно вручную искать совпадения — Автобиржа сама сводит цены и участников.",
    "home.whyUs.benefit2.title": "Реальные намерения",
    "home.whyUs.benefit2.description":
      "Депозит с обеих сторон подтверждает, что сделка серьёзная, а не праздный интерес.",
    "home.whyUs.benefit3.title": "Прозрачное движение цены",
    "home.whyUs.benefit3.description":
      "Вы всегда видите, как меняется цена и на сколько она приблизилась к сделке.",
    "home.whyUs.benefit4.title": "Контролируемый процесс",
    "home.whyUs.benefit4.description":
      "Контакты открываются только после подтверждения обеих сторон — без спама и случайных звонков.",

    "home.trust.eyebrow": "Безопасность сделки",
    "home.trust.title":
      "Контакты открываются только двум подтверждённым сторонам",
    "home.trust.description":
      "Депозит 1% — это не оплата автомобиля, а подтверждение серьёзности намерений. Пока не внесены оба депозита, объявления заморожены, а номера телефонов скрыты.",
    "home.trust.note":
      "Это защищает продавцов от случайных звонков и защищает покупателей от продавцов, которые передумали в последний момент.",
    "home.trust.matchCreated": "Match создан, объявления заморожены",
    "home.trust.checklist1": "Депозит от продавца подтверждён",
    "home.trust.checklist2": "Депозит от покупателя подтверждён",
    "home.trust.checklist3": "Номера телефонов открыты обеим сторонам",
    "home.trust.contactsOpen":
      "Контакты открыты — можно договариваться о сделке",

    "home.exchange.eyebrow": "Автобиржа",
    "home.exchange.title": "Как работает Автобиржа",
    "home.exchange.description":
      "Автоматический механизм, который сводит покупателя и продавца, когда их цены встречаются.",
    "home.exchange.step1.title": "Цены сближаются",
    "home.exchange.step1.description":
      "Цена продавца снижается на 1% в сутки, цена покупателя растёт на 1% в сутки — навстречу друг другу.",
    "home.exchange.step2.title": "Match и заморозка",
    "home.exchange.step2.description":
      "Когда разница в цене доходит примерно до 2%, система создаёт Match. Оба объявления замораживаются.",
    "home.exchange.step3.title": "Депозит 1%",
    "home.exchange.step3.description":
      "Продавец и покупатель вносят депозит в размере 1% от цены сделки — это подтверждает серьёзность намерений.",
    "home.exchange.step4.title": "Контакты открыты",
    "home.exchange.step4.description":
      "После того как оба депозита внесены, стороны получают контакты друг друга и договариваются о сделке.",

    "home.buyingWays.eyebrow": "Два пути к сделке",
    "home.buyingWays.title": "Два способа купить автомобиль",
    "home.buyingWays.description":
      "Выбирайте привычную покупку по объявлению или доверьте подбор цены Автобирже.",
    "home.buyingWays.way1.title": "Купить сейчас по текущей цене",
    "home.buyingWays.way1.description":
      "Выберите автомобиль по текущей цене, внесите 1% от стоимости через QR и свяжитесь с нами. После подтверждения депозита мы предоставим контакт продавца.",
    "home.buyingWays.way1.point1": "Покупка автомобиля по текущей цене",
    "home.buyingWays.way1.point2": "Депозит — 1% от стоимости автомобиля",
    "home.buyingWays.way1.point3": "После подтверждения депозита открывается контакт продавца",
    "home.buyingWays.way1.point4": "Сделку можно начать сразу",
    "home.buyingWays.way1.cta": "Смотреть автомобили",
    "home.buyingWays.way2.title": "Купить через Автобиржу",
    "home.buyingWays.way2.description":
      "Укажите цену, которую готовы заплатить. Система сама сведёт вас с продавцом, когда цены сойдутся.",
    "home.buyingWays.way2.point1": "Цена продавца снижается, ваша — растёт",
    "home.buyingWays.way2.point2": "Match создаётся автоматически",
    "home.buyingWays.way2.point3": "Контакты открываются после депозита",
    "home.buyingWays.way2.cta": "Создать заявку на покупку",

    "buy.howTo.eyebrow": "Прямая покупка",
    "buy.howTo.title": "Как купить по текущей цене",
    "buy.howTo.subtitle":
      "Для прямой покупки автомобиля внесите депозит 1% от текущей цены.",
    "buy.howTo.step1.title": "Выберите автомобиль",
    "buy.howTo.step1.description":
      "Откройте подходящее объявление и проверьте текущую цену.",
    "buy.howTo.step2.title": "Внесите 1% от текущей цены по QR",
    "buy.howTo.step2.description":
      "Оплатите 1% от текущей стоимости автомобиля по QR-коду.",
    "buy.howTo.step3.title": "Получите контакт продавца",
    "buy.howTo.step3.description":
      "После подтверждения платежа свяжитесь с нами по номеру +77027897120. После проверки депозита вам будет предоставлен номер телефона продавца.",
    "buy.qr.text": "Внесите 1% от текущей цены по QR",
    "buy.qr.imageAlt": "Halyk QR для оплаты депозита",

    "home.fresh.eyebrow": "Свежие объявления",
    "home.fresh.title": "Актуальные автомобили",
    "home.fresh.description": "Новые и проверенные объявления со всего Казахстана.",
    "home.fresh.viewAll": "Смотреть все",

    "home.finalCta.title":
      "Готовы продать или найти автомобиль по своей цене?",
    "home.finalCta.description":
      "Разместите объявление или создайте заявку на покупку — Автобиржа возьмёт согласование цены на себя.",

    "cars.subtitle": "Актуальные объявления со всего Казахстана.",
    "cars.backToAll": "Все автомобили",
    "cars.empty.filtered.title": "По выбранным параметрам автомобилей пока нет",
    "cars.empty.filtered.description":
      "Попробуйте изменить фильтры или создайте заявку на покупку — Автобиржа подберёт автомобиль автоматически.",
    "cars.empty.error.title": "Не удалось загрузить каталог",
    "cars.empty.error.description":
      "Сервер временно недоступен. Попробуйте обновить страницу через минуту.",

    "seller.title": "Продавец",
    "seller.dealer": "Автосалон",
    "seller.private": "Частное лицо",
    "seller.since": "на сайте",
    "seller.reviewsSuffix": "отзывов",

    "phone.reveal": "Показать номер",

    "price.label": "Цена",
    "price.currentSellerPrice": "Текущая цена продавца",
    "price.currentBuyerOffer": "Текущее предложение покупателя",
    "price.sellerDecreasing":
      "Цена продавца снижается на 1% в сутки, пока не встретится с ценой покупателя.",
    "price.buyerIncreasing":
      "Цена покупателя растёт на 1% в сутки, пока не встретится с ценой продавца.",
    "price.convergenceNote": "При схождении цен примерно до 2% система создаёт Match.",
    "price.depositNotice":
      "Контакты открываются только после того, как обе стороны внесут депозит 1% — это подтверждает серьёзность намерений.",
    "price.moreAboutExchange": "Подробнее об Автобирже",
    "price.directDeal": "Прямая сделка с продавцом, без посредников",

    "gallery.showPhoto": "Показать фото",
    "gallery.close": "Закрыть галерею",
    "gallery.prev": "Предыдущее фото",
    "gallery.next": "Следующее фото",

    "similarCars.title": "Похожие автомобили",
    "similarCars.description": "Другие варианты, которые могут вам подойти.",

    "emptyState.resetFilters": "Сбросить фильтры",

    "favorite.removeAction": "Убрать",
    "favorite.removeSuffix": "из избранного",
    "favorite.addAction": "Добавить",
    "favorite.addSuffix": "в избранное",

    "exchange.perDay": "% в сутки",

    "exchange.diagram.ariaLabel":
      "Цена продавца снижается, цена покупателя растёт, пока они не встретятся в точке Match",
    "exchange.diagram.seller": "Продавец: −1% в сутки",
    "exchange.diagram.buyer": "Покупатель: +1% в сутки",

    "exchange.depositsSafety.eyebrow": "Депозит и безопасность",
    "exchange.depositsSafety.title":
      "Контакты открываются только двум подтверждённым сторонам",
    "exchange.depositsSafety.description":
      "Депозит 1% — это не оплата автомобиля, а подтверждение серьёзности намерений. Пока не внесены оба депозита, объявления заморожены, а контакты скрыты.",
    "exchange.depositsSafety.note1":
      "До внесения обоих депозитов номера телефонов скрыты — это защищает продавца от случайных звонков, а покупателя — от продавцов, которые передумали в последний момент.",
    "exchange.depositsSafety.note2":
      "Депозит — это подтверждение намерений, а не оплата автомобиля. Если сделка не состоится по вине другой стороны, депозит возвращается в полном размере.",

    "exchange.lifecycle.stage1": "Match создан",
    "exchange.lifecycle.stage2": "Депозит продавца внесён",
    "exchange.lifecycle.stage3": "Депозит покупателя внесён",
    "exchange.lifecycle.stage4": "Контакты открыты",
    "exchange.lifecycle.expiredNote":
      "Если депозиты не внесены вовремя, объявления снова становятся активными.",
    "exchange.lifecycle.cancelledNote":
      "Если одна из сторон отменяет сделку, внесённый депозит возвращается.",

    "exchange.example.eyebrow": "Пример",
    "exchange.example.title": "Продавец и покупатель на пути к Match",
    "exchange.example.description":
      "Так выглядит реальная пара: объявление продавца и заявка покупателя, цены которых движутся навстречу друг другу.",
    "exchange.example.sellerListing": "Объявление продавца",
    "exchange.example.buyerRequest": "Заявка покупателя",
    "exchange.example.gapPercent": "Разница ≈2%",
    "exchange.example.untilMatch": "до автоматического Match",
    "exchange.example.neighboringRegions": "и соседние регионы",

    "exchange.steps.eyebrow": "Как это работает",
    "exchange.steps.title": "Пять шагов от объявления до сделки",
    "exchange.steps.description":
      "Автобиржа сама сводит покупателя и продавца — без ручного поиска и случайных звонков.",
    "exchange.steps.step1.title": "Укажите цену",
    "exchange.steps.step1.description":
      "Продавец назначает цену автомобиля, покупатель — сумму, которую готов заплатить.",
    "exchange.steps.step2.title": "Цены сближаются",
    "exchange.steps.step2.description":
      "Цена продавца снижается на 1% в сутки, предложение покупателя растёт на 1% в сутки.",
    "exchange.steps.step3.title": "Match",
    "exchange.steps.step3.description":
      "Когда разница доходит примерно до 2%, Автобиржа фиксирует совпадение и замораживает оба объявления.",
    "exchange.steps.step4.title": "Депозит 1%",
    "exchange.steps.step4.description":
      "Продавец и покупатель вносят депозит в размере 1% от цены — это подтверждает серьёзность намерений.",
    "exchange.steps.step5.title": "Контакты открыты",
    "exchange.steps.step5.description":
      "После двух депозитов стороны получают контакты друг друга и договариваются о сделке.",

    "exchange.hero.title": "Цены сами находят друг друга",
    "exchange.hero.description":
      "Продавец снижает цену на 1% в сутки, покупатель повышает предложение на 1% в сутки. Когда цены сближаются примерно до 2%, Автобиржа автоматически фиксирует сделку.",
    "exchange.hero.buyRequestCta": "Подать заявку на покупку",

    "exchange.simulator.sellerPriceDay": "Цена продавца · день",
    "exchange.simulator.buyerPriceDay": "Цена покупателя · день",
    "exchange.simulator.chartAriaLabel": "Изменение цены продавца и покупателя по дням",
    "exchange.simulator.dayRangeAriaLabel":
      "День с момента размещения объявления и заявки",
    "exchange.simulator.play": "Воспроизвести",
    "exchange.simulator.pause": "Остановить",
    "exchange.simulator.reset": "Сбросить",
    "exchange.simulator.matched": "Match: цены сошлись, объявления заморожены",
    "exchange.simulator.gap": "Разница в цене:",

    "exchange.page.visualizationEyebrow": "Визуализация",
    "exchange.page.visualizationTitle": "Как сближаются цены",
    "exchange.page.visualizationDescription":
      "Передвиньте ползунок или запустите воспроизведение — посмотрите, как цена продавца и предложение покупателя сходятся день за днём.",

    "auth.loading": "Загрузка…",
    "auth.registerTab": "Регистрация",
    "auth.terms": "Продолжая, вы соглашаетесь с условиями использования Автобиржи.",
    "auth.phone": "Телефон",
    "auth.password": "Пароль",
    "auth.enterPassword": "Введите пароль",
    "auth.loggingIn": "Входим…",
    "auth.loginError": "Не удалось войти, попробуйте позже",
    "auth.name": "Имя",
    "auth.confirmPassword": "Повторите пароль",
    "auth.passwordMinPlaceholder": "Не менее 6 символов",
    "auth.confirmPasswordPlaceholder": "Ещё раз пароль",
    "auth.creatingAccount": "Создаём аккаунт…",
    "auth.createAccount": "Создать аккаунт",
    "auth.registerError": "Не удалось создать аккаунт, попробуйте позже",

    "dashboard.nav.overview": "Обзор",
    "dashboard.nav.listings": "Мои объявления",
    "dashboard.nav.requests": "Заявки на покупку",
    "dashboard.nav.matches": "Matches",
    "dashboard.nav.deposits": "Депозиты",
    "dashboard.nav.notifications": "Уведомления",
    "dashboard.nav.profile": "Профиль",
    "dashboard.nav.openProfile": "Открыть профиль",

    "dashboard.overview.subtitle":
      "Главное о ваших объявлениях, заявках и сделках на Автобирже.",
    "dashboard.overview.loadError":
      "Не удалось загрузить обзор. Попробуйте обновить страницу через минуту.",
    "dashboard.overview.activeListings": "Активные объявления",
    "dashboard.overview.activeMatches": "Активные Match",
    "dashboard.overview.needsAttention": "Требуют внимания",
    "dashboard.overview.noTasks":
      "Активных задач нет — мы сообщим, когда что-то потребует вашего внимания.",
    "dashboard.overview.task.deposit": "Депозит",
    "dashboard.overview.task.moderation": "Модерация",
    "dashboard.overview.task.moderationCta": "Посмотреть",
    "dashboard.overview.task.newNotification": "Новое уведомление",
    "dashboard.overview.deadlinePrefix": "дедлайн",

    "dashboard.deposits.subtitle":
      "Депозит 1% подтверждает серьёзность намерений и открывает контакты после Match.",
    "dashboard.deposits.mockNotice":
      "Тестовый режим: оплата депозита здесь ничего не списывает по-настоящему — это симуляция для проверки сценария Auto Exchange, реальный платёжный шлюз ещё не подключён.",
    "dashboard.deposits.realNotice":
      "Оплата депозита обрабатывается платёжным провайдером FreedomPay — вы будете перенаправлены на защищённую страницу оплаты.",
    "dashboard.deposits.payError": "Не удалось внести депозит",
    "dashboard.deposits.loadErrorTitle": "Не удалось загрузить депозиты",
    "dashboard.deposits.emptyTitle": "Депозитов пока нет.",
    "dashboard.deposits.emptyDescription":
      "Депозит появится здесь, как только по вашему объявлению или заявке будет найден Match.",
    "dashboard.deposits.return.verifying": "Проверяем статус оплаты…",
    "dashboard.deposits.return.verifyingDescription":
      "Это займёт несколько секунд. Не закрывайте страницу.",
    "dashboard.deposits.return.success": "Оплата прошла успешно",
    "dashboard.deposits.return.failed": "Оплата не прошла",
    "dashboard.deposits.return.timeout":
      "Не удалось подтвердить оплату сразу. Проверьте статус в разделе «Депозиты» чуть позже.",
    "dashboard.deposits.return.backLink": "Вернуться к депозитам",

    "dashboard.listings.subtitle": "Объявления о продаже, которые вы разместили.",
    "dashboard.listings.loadErrorTitle": "Не удалось загрузить объявления",
    "dashboard.listings.emptyTitle": "У вас пока нет объявлений о продаже.",
    "dashboard.listings.emptyDescription":
      "Разместите автомобиль — Автобиржа сама подберёт покупателя по вашей цене.",

    "dashboard.favorites.subtitle": "Автомобили, которые вы сохранили для сравнения.",
    "dashboard.favorites.loadErrorTitle": "Не удалось загрузить избранное",
    "dashboard.favorites.emptyTitle": "В избранном пока пусто.",
    "dashboard.favorites.emptyDescription":
      "Нажимайте на сердечко на карточке автомобиля, чтобы сохранить его здесь.",

    "dashboard.notifications.subtitle":
      "Обновления по вашим объявлениям, заявкам и сделкам.",
    "dashboard.notifications.loadErrorTitle": "Не удалось загрузить уведомления",
    "dashboard.notifications.emptyTitle": "Уведомлений пока нет.",
    "dashboard.notifications.emptyDescription":
      "Здесь появятся обновления по вашим объявлениям и сделкам.",

    "dashboard.matches.subtitle":
      "Совпадения между вашими объявлениями и заявками других пользователей.",
    "dashboard.matches.loadErrorTitle": "Не удалось загрузить Match",
    "dashboard.matches.emptyTitle": "Пока нет активных Match.",
    "dashboard.matches.emptyDescription":
      "Как только цена продавца и покупателя сойдутся примерно до 2%, здесь появится совпадение.",

    "dashboard.requests.subtitle": "Ваши заявки на Автобирже и текущее предложение по ним.",
    "dashboard.requests.createCta": "Создать заявку",
    "dashboard.requests.loadErrorTitle": "Не удалось загрузить заявки",
    "dashboard.requests.emptyTitle": "У вас пока нет заявок на покупку.",
    "dashboard.requests.emptyDescription":
      "Создайте заявку, и Автобиржа будет искать подходящий автомобиль автоматически.",

    "dashboard.profile.title": "Профиль",
    "dashboard.profile.loggedInAs": "Вы вошли как",
    "dashboard.profile.email": "Email",
    "dashboard.profile.notSpecified": "Не указан",
    "dashboard.profile.accountType": "Тип аккаунта",
    "dashboard.profile.onSiteSince": "На сайте",

    "admin.sidebar.title": "Админка",
    "admin.listings.title": "Все объявления",
    "admin.users.title": "Пользователи",
    "admin.denied.title": "Доступ запрещён",
    "admin.denied.body":
      "Эта страница доступна только администраторам. Ваш аккаунт не имеет прав администратора.",
    "admin.denied.home": "На главную",

    "admin.filter.status": "Статус",
    "admin.filter.anyStatus": "Любой статус",
    "admin.pagination.prev": "Назад",
    "admin.pagination.next": "Вперёд",
    "admin.pagination.pageLabel": "Стр.",

    "admin.listings.subtitle": "Все объявления на платформе, независимо от продавца.",
    "admin.listings.loadErrorTitle": "Не удалось загрузить объявления",
    "admin.listings.emptyTitle": "Объявлений не найдено",
    "admin.listings.emptyDescription": "Попробуйте выбрать другой статус.",
    "admin.listings.archive": "Удалить",
    "admin.listings.archiving": "Удаляем…",
    "admin.listings.archiveConfirm": "Удалить это объявление? Действие нельзя отменить.",

    "admin.requests.subtitle": "Все заявки на покупку, независимо от покупателя.",
    "admin.requests.loadErrorTitle": "Не удалось загрузить заявки",
    "admin.requests.emptyTitle": "Заявок не найдено",
    "admin.requests.emptyDescription": "Попробуйте выбрать другой статус.",
    "admin.requests.archiveConfirm": "Удалить эту заявку? Действие нельзя отменить.",

    "admin.matches.subtitle": "Все сделки на платформе.",
    "admin.matches.loadErrorTitle": "Не удалось загрузить сделки",
    "admin.matches.emptyTitle": "Сделок не найдено",
    "admin.matches.emptyDescription": "Попробуйте выбрать другой статус.",
    "admin.matches.deposit": "Депозит",
    "admin.matches.deposits": "Депозиты (продавец/покупатель)",

    "admin.deposits.subtitle": "Все депозиты на платформе.",
    "admin.deposits.loadErrorTitle": "Не удалось загрузить депозиты",
    "admin.deposits.emptyTitle": "Депозитов не найдено",
    "admin.deposits.emptyDescription": "Попробуйте выбрать другой статус.",

    "admin.users.subtitle": "Поиск пользователей по имени или телефону.",
    "admin.users.loadErrorTitle": "Не удалось загрузить пользователей",
    "admin.users.emptyTitle": "Пользователи не найдены",
    "admin.users.emptyDescription": "Попробуйте изменить запрос.",
    "admin.users.searchLabel": "Поиск",
    "admin.users.searchPlaceholder": "Имя или телефон",

    "admin.stats.subtitle": "Общая статистика по AVTOBIRZHASI.KZ.",
    "admin.stats.loadError":
      "Не удалось загрузить статистику. Попробуйте обновить страницу через минуту.",
    "admin.stats.users": "Пользователи",
    "admin.stats.listings": "Объявления",
    "admin.stats.listings.active": "Активные",
    "admin.stats.listings.moderation": "На модерации",
    "admin.stats.listings.frozen": "Заморожены (в сделке)",
    "admin.stats.listings.archived": "В архиве",
    "admin.stats.listings.exchange": "Участвуют в Автобирже",
    "admin.stats.matches.awaitingDeposit": "Ожидают депозит",
    "admin.stats.matches.partiallyPaid": "Один депозит внесён",
    "admin.stats.matches.confirmed": "Подтверждены",
    "admin.stats.matches.expired": "Истёк срок",
    "admin.stats.matches.cancelled": "Отменены",
    "admin.stats.deposits.pending": "Ожидают оплаты",
    "admin.stats.deposits.paid": "Оплачены",
    "admin.stats.deposits.refunded": "Возвращены",

    "admin.moderation.title": "Модерация объявлений",
    "admin.moderation.subtitle": "Новые объявления, ожидающие проверки перед публикацией.",
    "admin.moderation.genericError": "Не удалось обработать объявление",
    "admin.moderation.loadErrorTitle": "Не удалось загрузить очередь модерации",
    "admin.moderation.rejecting": "Отклоняем…",
    "admin.moderation.reject": "Отклонить",
    "admin.moderation.approving": "Одобряем…",
    "admin.moderation.approve": "Одобрить",
    "admin.moderation.emptyTitle": "Очередь модерации пуста.",
    "admin.moderation.emptyDescription":
      "Новые объявления появятся здесь сразу после размещения.",

    "sort.newest": "Сначала новые",
    "sort.priceAsc": "Цена по возрастанию",
    "sort.priceDesc": "Цена по убыванию",
    "sort.yearDesc": "Год новее",
    "sort.ariaLabel": "Сортировка",

    "listingForm.stepBasics": "Основное",
    "listingForm.chooseMake": "Выберите марку",
    "listingForm.year": "Год выпуска",
    "listingForm.mileage": "Пробег, км",
    "listingForm.chooseRegion": "Выберите регион",
    "listingForm.choose": "Выберите",
    "listingForm.fuelType": "Тип топлива",
    "listingForm.engineVolume": "Объём двигателя, л",
    "listingForm.enginePower": "Мощность, л.с.",
    "listingForm.colorPlaceholder": "Белый",
    "listingForm.stepPricePhotos": "Цена и фото",
    "listingForm.saleMode": "Способ продажи",
    "listingForm.classifiedTitle": "Обычная продажа",
    "listingForm.classifiedDescription":
      "Фиксированная цена, покупатель звонит напрямую",
    "listingForm.exchangeDescription":
      "Цена снижается на 1% в сутки, пока не встретится с предложением покупателя",
    "listingForm.price": "Цена, ₸",
    "listingForm.description": "Описание (необязательно)",
    "listingForm.descriptionPlaceholder":
      "Расскажите об истории обслуживания, комплектации...",
    "listingForm.photos": "Фотографии",
    "listingForm.addPhoto": "Добавить фото",
    "listingForm.photoHint": "JPG, PNG или WebP, до 5 МБ, максимум 10 фото",
    "listingForm.uploadingPhotos": "Загрузка…",
    "listingForm.dropzoneTitle": "Перетащите фотографии сюда",
    "listingForm.dropzoneSubtitle": "или нажмите, чтобы выбрать файлы",
    "listingForm.dropzoneActive": "Отпустите фотографии здесь",
    "listingForm.dropzoneAria":
      "Загрузка фотографий: перетащите файлы сюда или нажмите, чтобы выбрать",
    "listingForm.photoTypeError": "Поддерживаются только JPG, PNG и WebP",
    "listingForm.photoSizeError": "Каждое фото должно быть не больше 5 МБ",
    "listingForm.photoCountError": "Можно добавить не больше 10 фотографий",
    "listingForm.photoUploadError": "Не удалось загрузить фото, попробуйте ещё раз",
    "listingForm.deletePhoto": "Удалить фото",
    "listingForm.back": "Назад",
    "listingForm.next": "Далее",
    "listingForm.publishing": "Публикуем…",
    "listingForm.publish": "Опубликовать объявление",
    "listingForm.createError": "Не удалось создать объявление, попробуйте позже",
    "listingForm.editTitle": "Редактировать объявление",
    "listingForm.saveChanges": "Сохранить изменения",
    "listingForm.saving": "Сохраняем…",
    "listingForm.cancel": "Отмена",
    "listingForm.saved": "Изменения сохранены",
    "listingForm.editError": "Не удалось сохранить изменения",

    "sellNew.description":
      "Заполните данные об автомобиле — объявление появится после модерации.",

    "requestForm.yearFrom": "Год от",
    "requestForm.yearTo": "Год до",
    "requestForm.initialOffer": "Стартовое предложение, ₸",
    "requestForm.growthNote":
      "Ваше предложение будет автоматически расти на 1% в день, пока не найдётся подходящее объявление в пределах 2%.",
    "requestForm.creating": "Создаём заявку…",
    "requestForm.createError": "Не удалось создать заявку, попробуйте позже",

    "requestNew.title": "Заявка на покупку",
    "requestNew.description":
      "Укажите, какой автомобиль вы ищете — Автобиржа сама найдёт подходящее объявление.",

    "password.hide": "Скрыть пароль",
    "password.show": "Показать пароль",

    "pagination.ariaLabel": "Пагинация",
    "pagination.prev": "Предыдущая страница",
    "pagination.next": "Следующая страница",

    "filters.title": "Фильтры",
    "filters.closeAria": "Закрыть фильтры",
    "filters.more": "Ещё фильтры",
    "filters.anyBodyType": "Любой кузов",
    "filters.anyTransmission": "Любая коробка",
    "filters.anyDrivetrain": "Любой привод",
    "filters.anyFuelType": "Любое топливо",
  },
  kz: {
    "nav.cars": "Автомобильдер",
    "nav.buy": "Сатып алу",
    "nav.sell": "Сату",
    "nav.exchange": "Автобиржа",
    "nav.howItWorks": "Бұл қалай жұмыс істейді",

    "header.favorites": "Таңдаулылар",
    "header.login": "Кіру",
    "header.dashboard": "Жеке кабинет",
    "header.adminPanel": "Админ-панель",
    "header.logout": "Шығу",
    "header.postAd": "Хабарландыру беру",
    "header.openMenu": "Мәзірді ашу",
    "header.closeMenu": "Мәзірді жабу",

    "theme.toDark": "Күңгірт тақырыпты қосу",
    "theme.toLight": "Жарық тақырыпты қосу",
    "theme.dark": "Күңгірт тақырып",
    "theme.light": "Жарық тақырып",

    "footer.tagline":
      "Қазақстанның автомобиль биржасы. Екі жаққа да ыңғайлы бағамен сатып алыңыз және сатыңыз.",
    "footer.buyers": "Сатып алушыларға",
    "footer.allCars": "Барлық автомобильдер",
    "footer.buyNow": "Қазір сатып алу",
    "footer.buyViaExchange": "Автобиржа арқылы сатып алу",
    "footer.favorites": "Таңдаулылар",
    "footer.sellers": "Сатушыларға",
    "footer.postAd": "Хабарландыру беру",
    "footer.howToSellFaster": "Жылдам сату жолы",
    "footer.howItWorks": "Бұл қалай жұмыс істейді",
    "footer.company": "Компания",
    "footer.about": "Біз туралы",
    "footer.safety": "Мәміле қауіпсіздігі",
    "footer.contacts": "Байланыс",
    "footer.rights": "© 2026 AVTOBIRZHASI.KZ. Барлық құқықтар қорғалған.",
    "footer.country": "Қазақстан",

    "specs.title": "Сипаттамалары",
    "specs.year": "Жыл",
    "specs.mileage": "Жүрісі",
    "specs.engine": "Қозғалтқыш",
    "specs.transmission": "Беріліс қорабы",
    "specs.drivetrain": "Жетек",
    "specs.bodyType": "Кузов",
    "specs.color": "Түсі",
    "specs.steeringWheel": "Руль",

    "description.title": "Сипаттама",
    "description.empty": "Сатушы бұл хабарландыруға сипаттама қоспаған.",

    "filters.from": "бастап",
    "filters.to": "дейін",
    "filters.yearSuffix": "ж.",
    "filters.resetAll": "Барлығын тазалау",

    "notification.unread": "Оқылмаған",

    "match.finalPrice": "Соңғы баға",
    "match.yourDeposit": "Сіздің депозитіңіз",
    "match.deadline": "Мерзімі",
    "match.sellerDeposit": "Сатушының депозиті:",
    "match.buyerDeposit": "Сатып алушының депозиті:",
    "match.paid": "төленді",
    "match.pending": "күтілуде",
    "match.payDeposit": "Депозит салу",
    "match.contactsOpen": "Байланыстар ашық →",
    "match.viewSimilar": "Ұқсастарын қарау",

    "row.updated": "Жаңартылды",
    "row.open": "Ашу",
    "row.actions": "Әрекеттер",
    "row.editListing": "Өңдеу",
    "row.pay": "Төлеу",
    "row.paying": "Төлену…",
    "row.details": "Толығырақ",
    "row.edit": "Өзгерту",
    "row.save": "Сақтау",
    "row.saving": "Сақталуда…",
    "row.cancelEdit": "Болдырмау",
    "row.delete": "Жою",
    "row.deleting": "Жойылуда…",
    "row.deleteConfirm": "Бұл хабарландыруды жою керек пе? Әрекетті болдырмау мүмкін емес.",
    "row.cancelRequest": "Өтінімді болдырмау",
    "row.cancelingRequest": "Болдырылуда…",
    "row.cancelRequestConfirm": "Бұл өтінімді болдырмау керек пе? Әрекетті болдырмау мүмкін емес.",
    "row.exchangePriceLocked": "Баға автообмен арқылы басқарылады және автоматты түрде өзгереді",

    "home.hero.eyebrow": "Қазақстанның автомобиль биржасы",
    "home.hero.title": "Өз бағаңызға сай автокөлік табыңыз",
    "home.hero.description":
      "Кездейсоқ қоңырауды күтпеңіз. Автобиржа сатып алушы мен сатушыны шарттар мен бағалар сәйкес келгенде автоматты түрде біріктіреді.",
    "home.hero.buyCta": "Автокөлік сатып алу",
    "home.hero.sellCta": "Автокөлік сату",
    "home.hero.imageAlt": "Премиум автокөлік",

    "quickSearch.region": "Аймақ",
    "quickSearch.anyRegion": "Кез келген аймақ",
    "quickSearch.make": "Марка",
    "quickSearch.anyMake": "Кез келген марка",
    "quickSearch.model": "Модель",
    "quickSearch.anyModel": "Кез келген модель",
    "quickSearch.year": "Жыл",
    "quickSearch.anyYear": "Кез келген",
    "quickSearch.price": "Баға",
    "quickSearch.anyPrice": "Кез келген баға",
    "quickSearch.submit": "Табу",

    "home.whyUs.eyebrow": "Неге AVTOBIRZHASI",
    "home.whyUs.title": "Платформаның артықшылықтары",
    "home.whyUs.benefit1.title": "Автоматты іріктеу",
    "home.whyUs.benefit1.description":
      "Сәйкестікті қолмен іздеудің қажеті жоқ — Автобиржа бағалар мен қатысушыларды өзі біріктіреді.",
    "home.whyUs.benefit2.title": "Нақты ниеттер",
    "home.whyUs.benefit2.description":
      "Екі жақтың да депозиті мәміленің шын ниетпен жасалғанын растайды.",
    "home.whyUs.benefit3.title": "Баға өзгерісінің ашықтығы",
    "home.whyUs.benefit3.description":
      "Баға қалай өзгеріп жатқанын және мәмілеге қаншалықты жақындағанын әрдайым көресіз.",
    "home.whyUs.benefit4.title": "Бақыланатын процесс",
    "home.whyUs.benefit4.description":
      "Байланыстар тек екі жақ та растағаннан кейін ашылады — спам мен кездейсоқ қоңыраулар болмайды.",

    "home.trust.eyebrow": "Мәміле қауіпсіздігі",
    "home.trust.title": "Байланыстар тек екі расталған жаққа ғана ашылады",
    "home.trust.description":
      "1% депозит — бұл автокөлікке төлем емес, ниеттің шындығын растау. Екі депозит те енгізілмейінше, хабарландырулар тоқтатылған, ал телефон нөмірлері жасырын.",
    "home.trust.note":
      "Бұл сатушыларды кездейсоқ қоңыраулардан, ал сатып алушыларды соңғы сәтте ойын өзгерткен сатушылардан қорғайды.",
    "home.trust.matchCreated": "Match жасалды, хабарландырулар тоқтатылды",
    "home.trust.checklist1": "Сатушының депозиті расталды",
    "home.trust.checklist2": "Сатып алушының депозиті расталды",
    "home.trust.checklist3": "Телефон нөмірлері екі жаққа да ашық",
    "home.trust.contactsOpen":
      "Байланыстар ашық — мәміле туралы келісуге болады",

    "home.exchange.eyebrow": "Автобиржа",
    "home.exchange.title": "Автобиржа қалай жұмыс істейді",
    "home.exchange.description":
      "Сатып алушы мен сатушыны бағалары сәйкес келгенде біріктіретін автоматты механизм.",
    "home.exchange.step1.title": "Бағалар жақындасады",
    "home.exchange.step1.description":
      "Сатушының бағасы тәулігіне 1%-ға төмендейді, сатып алушының бағасы тәулігіне 1%-ға өседі — бір-біріне қарай.",
    "home.exchange.step2.title": "Match және тоқтату",
    "home.exchange.step2.description":
      "Баға айырмашылығы шамамен 2%-ға жеткенде, жүйе Match жасайды. Екі хабарландыру да тоқтатылады.",
    "home.exchange.step3.title": "1% депозит",
    "home.exchange.step3.description":
      "Сатушы мен сатып алушы мәміле бағасының 1% мөлшерінде депозит енгізеді — бұл ниеттің шындығын растайды.",
    "home.exchange.step4.title": "Байланыстар ашық",
    "home.exchange.step4.description":
      "Екі депозит те енгізілгеннен кейін, тараптар бір-бірінің байланыстарын алып, мәміле туралы келіседі.",

    "home.buyingWays.eyebrow": "Мәмілеге апаратын екі жол",
    "home.buyingWays.title": "Автокөлік сатып алудың екі тәсілі",
    "home.buyingWays.description":
      "Хабарландыру бойынша әдеттегі сатып алуды таңдаңыз немесе баға таңдауды Автобиржаға сеніп тапсырыңыз.",
    "home.buyingWays.way1.title": "Қазір ағымдағы баға бойынша сатып алу",
    "home.buyingWays.way1.description":
      "Ағымдағы баға бойынша автокөлікті таңдап, құнының 1%-ын QR арқылы төлеп, бізбен байланысыңыз. Депозит расталғаннан кейін сатушының байланысын береміз.",
    "home.buyingWays.way1.point1": "Автокөлікті ағымдағы баға бойынша сатып алу",
    "home.buyingWays.way1.point2": "Депозит — автокөлік құнының 1%-ы",
    "home.buyingWays.way1.point3": "Депозит расталғаннан кейін сатушының байланысы ашылады",
    "home.buyingWays.way1.point4": "Мәмілені бірден бастауға болады",
    "home.buyingWays.way1.cta": "Автокөліктерді қарау",
    "home.buyingWays.way2.title": "Автобиржа арқылы сатып алу",
    "home.buyingWays.way2.description":
      "Төлеуге дайын бағаңызды көрсетіңіз. Бағалар сәйкес келгенде жүйе сізді сатушымен өзі біріктіреді.",
    "home.buyingWays.way2.point1": "Сатушының бағасы төмендейді, сіздікі — өседі",
    "home.buyingWays.way2.point2": "Match автоматты түрде жасалады",
    "home.buyingWays.way2.point3": "Байланыстар депозиттен кейін ашылады",
    "home.buyingWays.way2.cta": "Сатып алу өтінімін жасау",

    "buy.howTo.eyebrow": "Тікелей сатып алу",
    "buy.howTo.title": "Ағымдағы баға бойынша қалай сатып алу керек",
    "buy.howTo.subtitle":
      "Автокөлікті тікелей сатып алу үшін ағымдағы бағаның 1% депозитін төлеңіз.",
    "buy.howTo.step1.title": "Автокөлікті таңдаңыз",
    "buy.howTo.step1.description":
      "Қолайлы хабарландыруды ашып, ағымдағы бағаны тексеріңіз.",
    "buy.howTo.step2.title": "QR арқылы ағымдағы бағаның 1%-ын төлеңіз",
    "buy.howTo.step2.description":
      "Автокөліктің ағымдағы құнының 1%-ын QR-код арқылы төлеңіз.",
    "buy.howTo.step3.title": "Сатушының байланысын алыңыз",
    "buy.howTo.step3.description":
      "Төлем расталғаннан кейін +77027897120 нөмірі арқылы бізбен байланысыңыз. Депозит тексерілгеннен кейін сізге сатушының телефон нөмірі беріледі.",
    "buy.qr.text": "QR арқылы ағымдағы бағаның 1%-ын төлеңіз",
    "buy.qr.imageAlt": "Депозит төлеуге арналған Halyk QR",

    "home.fresh.eyebrow": "Жаңа хабарландырулар",
    "home.fresh.title": "Өзекті автокөліктер",
    "home.fresh.description":
      "Қазақстанның барлық аймақтарынан жаңа және тексерілген хабарландырулар.",
    "home.fresh.viewAll": "Барлығын қарау",

    "home.finalCta.title":
      "Автокөлікті өз бағаңызбен сатуға немесе табуға дайынсыз ба?",
    "home.finalCta.description":
      "Хабарландыру орналастырыңыз немесе сатып алу өтінімін жасаңыз — бағаны келісуді Автобиржа өз мойнына алады.",

    "cars.subtitle": "Қазақстанның барлық аймақтарынан өзекті хабарландырулар.",
    "cars.backToAll": "Барлық автомобильдер",
    "cars.empty.filtered.title": "Таңдалған параметрлер бойынша автокөліктер әзірге жоқ",
    "cars.empty.filtered.description":
      "Сүзгілерді өзгертіп көріңіз немесе сатып алу өтінімін жасаңыз — Автобиржа автокөлікті автоматты түрде таңдайды.",
    "cars.empty.error.title": "Каталогты жүктеу мүмкін болмады",
    "cars.empty.error.description":
      "Сервер уақытша қолжетімсіз. Бетті бір минуттан кейін жаңартып көріңіз.",

    "seller.title": "Сатушы",
    "seller.dealer": "Автосалон",
    "seller.private": "Жеке тұлға",
    "seller.since": "сайтта",
    "seller.reviewsSuffix": "пікір",

    "phone.reveal": "Нөмірді көрсету",

    "price.label": "Баға",
    "price.currentSellerPrice": "Сатушының ағымдағы бағасы",
    "price.currentBuyerOffer": "Сатып алушының ағымдағы ұсынысы",
    "price.sellerDecreasing":
      "Сатушының бағасы тәулігіне 1%-ға төмендейді, сатып алушының бағасымен теңескенше.",
    "price.buyerIncreasing":
      "Сатып алушының бағасы тәулігіне 1%-ға өседі, сатушының бағасымен теңескенше.",
    "price.convergenceNote": "Бағалар шамамен 2%-ға дейін жақындағанда жүйе Match жасайды.",
    "price.depositNotice":
      "Байланыстар тек екі жақ та 1% депозит енгізгеннен кейін ашылады — бұл ниеттің шындығын растайды.",
    "price.moreAboutExchange": "Автобиржа туралы толығырақ",
    "price.directDeal": "Сатушымен делдалсыз тікелей мәміле",

    "gallery.showPhoto": "Фотоны көрсету",
    "gallery.close": "Галереяны жабу",
    "gallery.prev": "Алдыңғы фото",
    "gallery.next": "Келесі фото",

    "similarCars.title": "Ұқсас автокөліктер",
    "similarCars.description": "Сізге ұнауы мүмкін басқа нұсқалар.",

    "emptyState.resetFilters": "Сүзгілерді тазалау",

    "favorite.removeAction": "Алып тастау",
    "favorite.removeSuffix": "таңдаулылардан",
    "favorite.addAction": "Қосу",
    "favorite.addSuffix": "таңдаулыларға",

    "exchange.perDay": "% тәулігіне",

    "exchange.diagram.ariaLabel":
      "Сатушының бағасы төмендейді, сатып алушының бағасы өседі, олар Match нүктесінде кездескенше",
    "exchange.diagram.seller": "Сатушы: −1% тәулігіне",
    "exchange.diagram.buyer": "Сатып алушы: +1% тәулігіне",

    "exchange.depositsSafety.eyebrow": "Депозит және қауіпсіздік",
    "exchange.depositsSafety.title":
      "Байланыстар тек екі расталған жаққа ғана ашылады",
    "exchange.depositsSafety.description":
      "1% депозит — бұл автокөлікке төлем емес, ниеттің шындығын растау. Екі депозит те енгізілмейінше, хабарландырулар тоқтатылған, ал байланыстар жасырын.",
    "exchange.depositsSafety.note1":
      "Екі депозит те енгізілгенге дейін телефон нөмірлері жасырын — бұл сатушыны кездейсоқ қоңыраулардан, ал сатып алушыны соңғы сәтте ойын өзгерткен сатушылардан қорғайды.",
    "exchange.depositsSafety.note2":
      "Депозит — бұл ниеттің растауы, автокөлікке төлем емес. Мәміле екінші жақтың кінәсінен орындалмаса, депозит толық көлемде қайтарылады.",

    "exchange.lifecycle.stage1": "Match жасалды",
    "exchange.lifecycle.stage2": "Сатушының депозиті енгізілді",
    "exchange.lifecycle.stage3": "Сатып алушының депозиті енгізілді",
    "exchange.lifecycle.stage4": "Байланыстар ашылды",
    "exchange.lifecycle.expiredNote":
      "Депозиттер уақытында енгізілмесе, хабарландырулар қайта белсенді болады.",
    "exchange.lifecycle.cancelledNote":
      "Тараптардың бірі мәміледен бас тартса, енгізілген депозит қайтарылады.",

    "exchange.example.eyebrow": "Мысал",
    "exchange.example.title": "Сатушы мен сатып алушы Match-қа қарай",
    "exchange.example.description":
      "Нақты жұп осылай көрінеді: сатушының хабарландыруы мен сатып алушының өтінімі, олардың бағалары бір-біріне қарай жылжиды.",
    "exchange.example.sellerListing": "Сатушының хабарландыруы",
    "exchange.example.buyerRequest": "Сатып алушының өтінімі",
    "exchange.example.gapPercent": "Айырмашылық ≈2%",
    "exchange.example.untilMatch": "автоматты Match-қа дейін",
    "exchange.example.neighboringRegions": "және көрші аймақтар",

    "exchange.steps.eyebrow": "Бұл қалай жұмыс істейді",
    "exchange.steps.title": "Хабарландырудан мәмілеге дейінгі бес қадам",
    "exchange.steps.description":
      "Автобиржа сатып алушы мен сатушыны өзі біріктіреді — қолмен іздеусіз және кездейсоқ қоңыраусыз.",
    "exchange.steps.step1.title": "Бағаны көрсетіңіз",
    "exchange.steps.step1.description":
      "Сатушы автокөлік бағасын белгілейді, сатып алушы — төлеуге дайын соманы.",
    "exchange.steps.step2.title": "Бағалар жақындасады",
    "exchange.steps.step2.description":
      "Сатушының бағасы тәулігіне 1%-ға төмендейді, сатып алушының ұсынысы тәулігіне 1%-ға өседі.",
    "exchange.steps.step3.title": "Match",
    "exchange.steps.step3.description":
      "Айырмашылық шамамен 2%-ға жеткенде, Автобиржа сәйкестікті тіркеп, екі хабарландыруды да тоқтатады.",
    "exchange.steps.step4.title": "1% депозит",
    "exchange.steps.step4.description":
      "Сатушы мен сатып алушы бағаның 1% мөлшерінде депозит енгізеді — бұл ниеттің шындығын растайды.",
    "exchange.steps.step5.title": "Байланыстар ашылды",
    "exchange.steps.step5.description":
      "Екі депозиттен кейін тараптар бір-бірінің байланыстарын алып, мәміле туралы келіседі.",

    "exchange.hero.title": "Бағалар бір-бірін өздігінен табады",
    "exchange.hero.description":
      "Сатушы бағаны тәулігіне 1%-ға төмендетеді, сатып алушы ұсынысын тәулігіне 1%-ға көтереді. Бағалар шамамен 2%-ға дейін жақындағанда, Автобиржа мәмілені автоматты түрде тіркейді.",
    "exchange.hero.buyRequestCta": "Сатып алу өтінімін беру",

    "exchange.simulator.sellerPriceDay": "Сатушының бағасы · күн",
    "exchange.simulator.buyerPriceDay": "Сатып алушының бағасы · күн",
    "exchange.simulator.chartAriaLabel": "Сатушы мен сатып алушы бағасының күн сайынғы өзгерісі",
    "exchange.simulator.dayRangeAriaLabel":
      "Хабарландыру мен өтінім орналастырылғаннан бергі күн",
    "exchange.simulator.play": "Іске қосу",
    "exchange.simulator.pause": "Тоқтату",
    "exchange.simulator.reset": "Қалпына келтіру",
    "exchange.simulator.matched": "Match: бағалар сәйкес келді, хабарландырулар тоқтатылды",
    "exchange.simulator.gap": "Баға айырмашылығы:",

    "exchange.page.visualizationEyebrow": "Визуализация",
    "exchange.page.visualizationTitle": "Бағалар қалай жақындасады",
    "exchange.page.visualizationDescription":
      "Жүгірткіні жылжытыңыз немесе ойнатуды іске қосыңыз — сатушының бағасы мен сатып алушының ұсынысы күн сайын қалай жақындасатынын көріңіз.",

    "auth.loading": "Жүктелуде…",
    "auth.registerTab": "Тіркелу",
    "auth.terms": "Жалғастыра отырып, сіз Автобиржаны пайдалану шарттарымен келісесіз.",
    "auth.phone": "Телефон",
    "auth.password": "Құпия сөз",
    "auth.enterPassword": "Құпия сөзді енгізіңіз",
    "auth.loggingIn": "Кіру…",
    "auth.loginError": "Кіру мүмкін болмады, кейінірек көріңіз",
    "auth.name": "Аты-жөні",
    "auth.confirmPassword": "Құпия сөзді қайталаңыз",
    "auth.passwordMinPlaceholder": "Кемінде 6 таңба",
    "auth.confirmPasswordPlaceholder": "Құпия сөзді қайта енгізіңіз",
    "auth.creatingAccount": "Аккаунт жасалуда…",
    "auth.createAccount": "Аккаунт жасау",
    "auth.registerError": "Аккаунт жасау мүмкін болмады, кейінірек көріңіз",

    "dashboard.nav.overview": "Шолу",
    "dashboard.nav.listings": "Менің хабарландыруларым",
    "dashboard.nav.requests": "Сатып алу өтінімдері",
    "dashboard.nav.matches": "Matches",
    "dashboard.nav.deposits": "Депозиттер",
    "dashboard.nav.notifications": "Ескертулер",
    "dashboard.nav.profile": "Профиль",
    "dashboard.nav.openProfile": "Профильді ашу",

    "dashboard.overview.subtitle":
      "Автобиржадағы хабарландыруларыңыз, өтінімдеріңіз және мәмілелеріңіз туралы негізгі ақпарат.",
    "dashboard.overview.loadError":
      "Шолуды жүктеу мүмкін болмады. Бетті бір минуттан кейін жаңартып көріңіз.",
    "dashboard.overview.activeListings": "Белсенді хабарландырулар",
    "dashboard.overview.activeMatches": "Белсенді Match",
    "dashboard.overview.needsAttention": "Назар аударуды қажет етеді",
    "dashboard.overview.noTasks":
      "Белсенді тапсырмалар жоқ — бірдеңе назар аударуды қажет еткенде хабарлаймыз.",
    "dashboard.overview.task.deposit": "Депозит",
    "dashboard.overview.task.moderation": "Модерация",
    "dashboard.overview.task.moderationCta": "Қарау",
    "dashboard.overview.task.newNotification": "Жаңа ескерту",
    "dashboard.overview.deadlinePrefix": "мерзімі",

    "dashboard.deposits.subtitle":
      "1% депозит ниеттің шындығын растайды және Match-тан кейін байланыстарды ашады.",
    "dashboard.deposits.mockNotice":
      "Тестілік режим: мұндағы депозит төлемі нақты ақша есептен шығармайды — бұл Auto Exchange сценарийін тексеруге арналған симуляция, нақты төлем шлюзі әлі қосылмаған.",
    "dashboard.deposits.realNotice":
      "Депозит төлемі FreedomPay төлем провайдері арқылы өңделеді — сіз қорғалған төлем бетіне бағытталасыз.",
    "dashboard.deposits.payError": "Депозитті енгізу мүмкін болмады",
    "dashboard.deposits.loadErrorTitle": "Депозиттерді жүктеу мүмкін болмады",
    "dashboard.deposits.emptyTitle": "Депозиттер әзірше жоқ.",
    "dashboard.deposits.emptyDescription":
      "Депозит хабарландыруыңыз немесе өтініміңіз бойынша Match табылғанда осында пайда болады.",
    "dashboard.deposits.return.verifying": "Төлем мәртебесін тексеріп жатырмыз…",
    "dashboard.deposits.return.verifyingDescription":
      "Бұл бірнеше секунд алады. Бетті жаппаңыз.",
    "dashboard.deposits.return.success": "Төлем сәтті өтті",
    "dashboard.deposits.return.failed": "Төлем өтпеді",
    "dashboard.deposits.return.timeout":
      "Төлемді дереу растау мүмкін болмады. «Депозиттер» бөлімінен мәртебені кейінірек тексеріңіз.",
    "dashboard.deposits.return.backLink": "Депозиттерге оралу",

    "dashboard.listings.subtitle": "Сіз орналастырған сату хабарландырулары.",
    "dashboard.listings.loadErrorTitle": "Хабарландыруларды жүктеу мүмкін болмады",
    "dashboard.listings.emptyTitle": "Сізде әзірше сату хабарландырулары жоқ.",
    "dashboard.listings.emptyDescription":
      "Автокөлікті орналастырыңыз — Автобиржа сіздің бағаңызға сай сатып алушыны өзі табады.",

    "dashboard.favorites.subtitle": "Салыстыру үшін сақтаған автокөліктеріңіз.",
    "dashboard.favorites.loadErrorTitle": "Таңдаулыларды жүктеу мүмкін болмады",
    "dashboard.favorites.emptyTitle": "Таңдаулылар әзірше бос.",
    "dashboard.favorites.emptyDescription":
      "Мұнда сақтау үшін автокөлік карточкасындағы жүрекшені басыңыз.",

    "dashboard.notifications.subtitle":
      "Хабарландыруларыңыз, өтінімдеріңіз және мәмілелеріңіз бойынша жаңартулар.",
    "dashboard.notifications.loadErrorTitle": "Ескертулерді жүктеу мүмкін болмады",
    "dashboard.notifications.emptyTitle": "Ескертулер әзірше жоқ.",
    "dashboard.notifications.emptyDescription":
      "Мұнда хабарландыруларыңыз бен мәмілелеріңіз бойынша жаңартулар пайда болады.",

    "dashboard.matches.subtitle":
      "Сіздің хабарландыруларыңыз бен басқа пайдаланушылардың өтінімдері арасындағы сәйкестіктер.",
    "dashboard.matches.loadErrorTitle": "Match жүктеу мүмкін болмады",
    "dashboard.matches.emptyTitle": "Әзірше белсенді Match жоқ.",
    "dashboard.matches.emptyDescription":
      "Сатушы мен сатып алушының бағасы шамамен 2%-ға дейін жақындағанда, мұнда сәйкестік пайда болады.",

    "dashboard.requests.subtitle":
      "Автобиржадағы өтінімдеріңіз және олар бойынша ағымдағы ұсыныс.",
    "dashboard.requests.createCta": "Өтінім жасау",
    "dashboard.requests.loadErrorTitle": "Өтінімдерді жүктеу мүмкін болмады",
    "dashboard.requests.emptyTitle": "Сізде әзірше сатып алу өтінімдері жоқ.",
    "dashboard.requests.emptyDescription":
      "Өтінім жасаңыз, Автобиржа сәйкес автокөлікті автоматты түрде іздейді.",

    "dashboard.profile.title": "Профиль",
    "dashboard.profile.loggedInAs": "Сіз кірдіңіз:",
    "dashboard.profile.email": "Email",
    "dashboard.profile.notSpecified": "Көрсетілмеген",
    "dashboard.profile.accountType": "Аккаунт түрі",
    "dashboard.profile.onSiteSince": "Сайтта",

    "admin.sidebar.title": "Әкімшілік панелі",
    "admin.listings.title": "Барлық хабарландырулар",
    "admin.users.title": "Пайдаланушылар",
    "admin.denied.title": "Қатынау тыйым салынған",
    "admin.denied.body":
      "Бұл бет тек әкімшілерге қолжетімді. Сіздің аккаунтыңызда әкімші құқықтары жоқ.",
    "admin.denied.home": "Басты бетке",

    "admin.filter.status": "Мәртебе",
    "admin.filter.anyStatus": "Кез келген мәртебе",
    "admin.pagination.prev": "Артқа",
    "admin.pagination.next": "Алға",
    "admin.pagination.pageLabel": "Бет",

    "admin.listings.subtitle": "Платформадағы барлық хабарландырулар, сатушысына қарамастан.",
    "admin.listings.loadErrorTitle": "Хабарландыруларды жүктеу мүмкін болмады",
    "admin.listings.emptyTitle": "Хабарландырулар табылмады",
    "admin.listings.emptyDescription": "Басқа мәртебені таңдап көріңіз.",
    "admin.listings.archive": "Жою",
    "admin.listings.archiving": "Жойылуда…",
    "admin.listings.archiveConfirm": "Бұл хабарландыруды жою керек пе? Әрекетті болдырмау мүмкін емес.",

    "admin.requests.subtitle": "Платформадағы барлық сатып алу өтінімдері, сатып алушысына қарамастан.",
    "admin.requests.loadErrorTitle": "Өтінімдерді жүктеу мүмкін болмады",
    "admin.requests.emptyTitle": "Өтінімдер табылмады",
    "admin.requests.emptyDescription": "Басқа мәртебені таңдап көріңіз.",
    "admin.requests.archiveConfirm": "Бұл өтінімді жою керек пе? Әрекетті болдырмау мүмкін емес.",

    "admin.matches.subtitle": "Платформадағы барлық мәмілелер.",
    "admin.matches.loadErrorTitle": "Мәмілелерді жүктеу мүмкін болмады",
    "admin.matches.emptyTitle": "Мәмілелер табылмады",
    "admin.matches.emptyDescription": "Басқа мәртебені таңдап көріңіз.",
    "admin.matches.deposit": "Депозит",
    "admin.matches.deposits": "Депозиттер (сатушы/сатып алушы)",

    "admin.deposits.subtitle": "Платформадағы барлық депозиттер.",
    "admin.deposits.loadErrorTitle": "Депозиттерді жүктеу мүмкін болмады",
    "admin.deposits.emptyTitle": "Депозиттер табылмады",
    "admin.deposits.emptyDescription": "Басқа мәртебені таңдап көріңіз.",

    "admin.users.subtitle": "Пайдаланушыларды аты немесе телефоны бойынша іздеу.",
    "admin.users.loadErrorTitle": "Пайдаланушыларды жүктеу мүмкін болмады",
    "admin.users.emptyTitle": "Пайдаланушылар табылмады",
    "admin.users.emptyDescription": "Сұрауды өзгертіп көріңіз.",
    "admin.users.searchLabel": "Іздеу",
    "admin.users.searchPlaceholder": "Аты немесе телефоны",

    "admin.stats.subtitle": "AVTOBIRZHASI.KZ бойынша жалпы статистика.",
    "admin.stats.loadError":
      "Статистиканы жүктеу мүмкін болмады. Бетті бір минуттан кейін жаңартып көріңіз.",
    "admin.stats.users": "Пайдаланушылар",
    "admin.stats.listings": "Хабарландырулар",
    "admin.stats.listings.active": "Белсенді",
    "admin.stats.listings.moderation": "Модерацияда",
    "admin.stats.listings.frozen": "Тоқтатылған (мәміледе)",
    "admin.stats.listings.archived": "Мұрағатта",
    "admin.stats.listings.exchange": "Автобиржаға қатысады",
    "admin.stats.matches.awaitingDeposit": "Депозит күтілуде",
    "admin.stats.matches.partiallyPaid": "Бір депозит енгізілді",
    "admin.stats.matches.confirmed": "Расталды",
    "admin.stats.matches.expired": "Мерзімі өтті",
    "admin.stats.matches.cancelled": "Болдырылмады",
    "admin.stats.deposits.pending": "Төлем күтілуде",
    "admin.stats.deposits.paid": "Төленді",
    "admin.stats.deposits.refunded": "Қайтарылды",

    "admin.moderation.title": "Хабарландыруларды модерациялау",
    "admin.moderation.subtitle": "Жариялауға дейін тексеруді күтетін жаңа хабарландырулар.",
    "admin.moderation.genericError": "Хабарландыруды өңдеу мүмкін болмады",
    "admin.moderation.loadErrorTitle": "Модерация кезегін жүктеу мүмкін болмады",
    "admin.moderation.rejecting": "Қабылдамаудамыз…",
    "admin.moderation.reject": "Қабылдамау",
    "admin.moderation.approving": "Мақұлдаудамыз…",
    "admin.moderation.approve": "Мақұлдау",
    "admin.moderation.emptyTitle": "Модерация кезегі бос.",
    "admin.moderation.emptyDescription":
      "Жаңа хабарландырулар орналастырылғаннан кейін бірден осында пайда болады.",

    "sort.newest": "Алдымен жаңалары",
    "sort.priceAsc": "Баға өсу бойынша",
    "sort.priceDesc": "Баға кему бойынша",
    "sort.yearDesc": "Жаңа жылы бойынша",
    "sort.ariaLabel": "Сұрыптау",

    "listingForm.stepBasics": "Негізгі",
    "listingForm.chooseMake": "Марканы таңдаңыз",
    "listingForm.year": "Шығарылған жылы",
    "listingForm.mileage": "Жүрісі, км",
    "listingForm.chooseRegion": "Аймақты таңдаңыз",
    "listingForm.choose": "Таңдаңыз",
    "listingForm.fuelType": "Отын түрі",
    "listingForm.engineVolume": "Қозғалтқыш көлемі, л",
    "listingForm.enginePower": "Қуаты, а.к.",
    "listingForm.colorPlaceholder": "Ақ",
    "listingForm.stepPricePhotos": "Баға және фотосуреттер",
    "listingForm.saleMode": "Сату тәсілі",
    "listingForm.classifiedTitle": "Кәдімгі сату",
    "listingForm.classifiedDescription":
      "Тұрақты баға, сатып алушы тікелей хабарласады",
    "listingForm.exchangeDescription":
      "Баға сатып алушының ұсынысымен теңескенше тәулігіне 1%-ға төмендейді",
    "listingForm.price": "Баға, ₸",
    "listingForm.description": "Сипаттама (міндетті емес)",
    "listingForm.descriptionPlaceholder":
      "Қызмет көрсету тарихы, жинақтамасы туралы айтыңыз...",
    "listingForm.photos": "Фотосуреттер",
    "listingForm.addPhoto": "Фото қосу",
    "listingForm.photoHint": "JPG, PNG немесе WebP, 5 МБ дейін, ең көбі 10 фото",
    "listingForm.uploadingPhotos": "Жүктелуде…",
    "listingForm.dropzoneTitle": "Фотосуреттерді осында сүйреп апарыңыз",
    "listingForm.dropzoneSubtitle": "немесе файлдарды таңдау үшін басыңыз",
    "listingForm.dropzoneActive": "Фотосуреттерді осында жіберіңіз",
    "listingForm.dropzoneAria":
      "Фотосуреттерді жүктеу: файлдарды осында сүйреп апарыңыз немесе таңдау үшін басыңыз",
    "listingForm.photoTypeError": "Тек JPG, PNG және WebP қолдау көрсетіледі",
    "listingForm.photoSizeError": "Әр фото 5 МБ-тан аспауы керек",
    "listingForm.photoCountError": "10 фотосуреттен артық қосуға болмайды",
    "listingForm.photoUploadError": "Фотоны жүктеу мүмкін болмады, қайталап көріңіз",
    "listingForm.deletePhoto": "Фотоны жою",
    "listingForm.back": "Артқа",
    "listingForm.next": "Келесі",
    "listingForm.publishing": "Жариялаудамыз…",
    "listingForm.publish": "Хабарландыруды жариялау",
    "listingForm.createError": "Хабарландыру жасау мүмкін болмады, кейінірек көріңіз",
    "listingForm.editTitle": "Хабарландыруды өңдеу",
    "listingForm.saveChanges": "Өзгерістерді сақтау",
    "listingForm.saving": "Сақталуда…",
    "listingForm.cancel": "Болдырмау",
    "listingForm.saved": "Өзгерістер сақталды",
    "listingForm.editError": "Өзгерістерді сақтау мүмкін болмады",

    "sellNew.description":
      "Автокөлік туралы деректерді толтырыңыз — хабарландыру модерациядан кейін пайда болады.",

    "requestForm.yearFrom": "Жылдан",
    "requestForm.yearTo": "Жылға дейін",
    "requestForm.initialOffer": "Бастапқы ұсыныс, ₸",
    "requestForm.growthNote":
      "Сіздің ұсынысыңыз 2% шегінде сәйкес хабарландыру табылғанша күніне автоматты түрде 1%-ға өседі.",
    "requestForm.creating": "Өтінім жасалуда…",
    "requestForm.createError": "Өтінім жасау мүмкін болмады, кейінірек көріңіз",

    "requestNew.title": "Сатып алу өтінімі",
    "requestNew.description":
      "Қандай автокөлік іздеп жатқаныңызды көрсетіңіз — Автобиржа сәйкес хабарландыруды өзі табады.",

    "password.hide": "Құпия сөзді жасыру",
    "password.show": "Құпия сөзді көрсету",

    "pagination.ariaLabel": "Беттеу",
    "pagination.prev": "Алдыңғы бет",
    "pagination.next": "Келесі бет",

    "filters.title": "Сүзгілер",
    "filters.closeAria": "Сүзгілерді жабу",
    "filters.more": "Тағы сүзгілер",
    "filters.anyBodyType": "Кез келген кузов",
    "filters.anyTransmission": "Кез келген беріліс қорабы",
    "filters.anyDrivetrain": "Кез келген жетек",
    "filters.anyFuelType": "Кез келген отын",
  },
} as const;

export type Lang = keyof typeof translations;
export type TranslationKey = keyof (typeof translations)["ru"];
