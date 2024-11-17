import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';


function isValid(date) {
  const now = new Date();
  if (new Date(date) > now) {
    const lastDismissedDate = localStorage.getItem(
      "lastMaintenanceDismissed"
    );
    const todayString = now.toISOString().split("T")[0];

    if (lastDismissedDate !== todayString) {
      return true;
    }
  }
  return false;
}

const timeZoneAbbreviated = () => {
  const { 1: tz } = new Date().toString().match(/\((.+)\)/);

  if (tz.includes(" ")) {
    return tz
      .split(" ")
      .map(([first]) => first)
      .join("");
  } else {
    return tz;
  }
};

function renderEjsTemplate(template, data) {
  return template.replace(
    /<%= (\w+) %>/g,
    (match, key) => data[key] || ""
  );
}

if (ExecutionEnvironment.canUseDOM) {
  const dayjs = require('dayjs');

  dayjs.extend(require('dayjs/plugin/utc'));
  dayjs.extend(require('dayjs/plugin/advancedFormat'));
  dayjs.extend(require('dayjs/plugin/timezone'));

  let config = await fetch(
    "https://nocodb.com/api/v1/config?get=maintenance"
  )
    .then(async (res) => (await res.json()).value)
    .catch((e) => {
      console.error("Error fetching maintenance config", e);
      return null;
    });

  if (typeof config === "string") {
    config = JSON.parse(config);
  }

  if (config && isValid(config.date)) {
    const compiledText = renderEjsTemplate(config.description, {
      date: `${dayjs(config.date).format(
        "YYYY-MM-DD HH:mm"
      )} ${timeZoneAbbreviated()}`,
      ptTime: dayjs(config.date)
        .tz("America/Los_Angeles")
        .format("HH:mm z"),
    });

    const innerHtml = `
     <div style="font-family: Manrope;">
     <div style="font-weight: bold; color: #1f293a; font-size: 18px">${config.title}</div>
     <p style="color: #374151"">${compiledText}</p>
        <a target="_blank" href="${config.url}" style="color: white; padding-inline: 8px; padding-block: 4px; background: #3366ff; border-radius: 0.5rem; text-decoration: none;">
        Learn More
        </a>
     </div>
    `;

    const divElem = document.createElement("div");
    divElem.classList.add("maintenance-banner");
    divElem.style.position = "fixed";
    divElem.style.bottom = "20px";
    divElem.style.right = "-350px";
    divElem.style.borderRadius = "0.75rem";
    divElem.style.width = "300px";
    divElem.style.padding = "12px";
    divElem.style.transition = "1s opacity, 1s right";
    divElem.style.background = "#FEE6D6";
    divElem.style.color = "#1F293A";
    divElem.style.zIndex = "1000";
    divElem.style.display = "flex";
    divElem.innerHTML = innerHtml;

    const closeBtn = document.createElement("button");
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "8px";
    closeBtn.style.right = "8px";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.color = "#1F293A";
    closeBtn.innerHTML =
      '<svg class="nc-icon" viewBox="0 0 24 24" width="1.2em" height="1.2em"><path fill="currentColor" d="m12 13.4l-4.9 4.9q-.275.275-.7.275t-.7-.275q-.275-.275-.275-.7t.275-.7l4.9-4.9l-4.9-4.9q-.275-.275-.275-.7t.275-.7q.275-.275.7-.275t.7.275l4.9 4.9l4.9-4.9q.275-.275.7-.275t.7.275q.275.275.275.7t-.275.7L13.4 12l4.9 4.9q.275.275.275.7t-.275.7q-.275.275-.7.275t-.7-.275z"></path></svg>';
    closeBtn.onclick = () => {
      divElem.style.display = "none";
      localStorage.setItem(
        "lastMaintenanceDismissed",
        new Date().toISOString().split("T")[0]
      );
    };

    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
         .maintenance-banner.active {
         opacity: 1;
         right:28px !important;
         }
               `;

    divElem.appendChild(closeBtn);

    document.body.appendChild(divElem);
    setTimeout(() => divElem.classList.add("active"), 2000);
    document.body.appendChild(styleEl);
  }
}
