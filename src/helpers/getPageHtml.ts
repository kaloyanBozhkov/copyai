import { parse } from "node-html-parser";
import puppeteer from "puppeteer";

export const getPageHTML = async (url: string, selector = "html") => {
  try {
    const pageHTML = await fetch(url).then((res) => res.text());
    const document = parse(pageHTML);
    console.log("document", document.toString());
    const element = document.querySelector(selector);
    if (!element) return "";
    return element.innerHTML;
  } catch (error) {
    console.error(error);
    return "";
  }
};

export const getPageHTMLWithJS = async ({
  url,
  selector = "html",
  limit = 1,
  skip = 0,
  returnOuterHTML = false,
}: {
  url: string;
  selector: string;
  limit?: number;
  skip?: number;
  returnOuterHTML?: boolean;
}) => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    const elements = await page.$$(selector);
    if (!elements.length) return {
      elementsHTML: [],
      text: "",
    };

    const htmls = await Promise.all(
      elements.slice(skip, skip + limit).map(async (element) => {
        const html = await page.evaluate(
          (el, useOuter) => (useOuter ? el.outerHTML : el.innerHTML),
          element,
          returnOuterHTML
        );
        return html;
      })
    );
    return {
      elementsHTML: htmls,
      text: htmls.join("\n"),
    };
  } catch (error) {
    console.error(error);
    return {
      elementsHTML: [],
      text: "",
    };
  } finally {
    await browser.close();
  }
};
