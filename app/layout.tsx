import type { Metadata, Viewport } from "next";
import "./globals.css";

// The styles need Chrome 111+ (Android 11 ships far older). On an outdated browser, cover the page with a
// plain update notice. ES5 + inline styles, so it works where the app's CSS and JS can't.
const OUTDATED_BROWSER = String.raw`(function(){try{if(window.CSS&&CSS.supports&&CSS.supports("color","color-mix(in srgb, red, blue)"))return}catch(e){}
var v=/Chrome\/(\d+)/.exec(navigator.userAgent),d=document.createElement("div");d.setAttribute("role","alert");
d.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#f4f6f5;color:#15201b;display:flex;align-items:center;justify-content:center;padding:32px;text-align:center;font:20px/1.5 system-ui,sans-serif";
d.innerHTML='<div style="max-width:560px"><p style="font-size:28px;font-weight:600;margin:0 0 8px">This browser is out of date</p><p style="margin:0 0 28px">Please update Google Chrome from the Play Store, then open this page again.</p><p style="font-size:26px;font-weight:600;margin:0 0 8px">यह ब्राउज़र पुराना है</p><p style="margin:0">कृपया Play Store से Google Chrome अपडेट करें, फिर यह पेज दोबारा खोलें।</p>'+(v?'<p style="margin:28px 0 0;font-size:15px;color:#65726c">Chrome '+v[1]+' · needs 111 or newer</p>':'')+'</div>';
document.body.appendChild(d)})();`;

export const metadata: Metadata = {
  title: "atreya.ai",
  description: "atreya.ai data collection kiosk",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F4F6F5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <script dangerouslySetInnerHTML={{ __html: OUTDATED_BROWSER }} />
      </body>
    </html>
  );
}
