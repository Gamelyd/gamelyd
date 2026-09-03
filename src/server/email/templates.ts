import "server-only";
import { env } from "../env";

const BRAND = "#0BC0B4";

function layout(body: string): string {
  return `
  <div style="background:#1F2731;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#B8BCBF">
    <div style="max-width:560px;margin:0 auto;background:#1F2833;border-radius:12px;overflow:hidden;border:1px solid #2a3540">
      <div style="background:linear-gradient(96deg,#0BC0B4 -29.36%,#242E39 102.77%);padding:24px 28px">
        <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:1px">GAMELYD</h1>
      </div>
      <div style="padding:28px">${body}</div>
      <div style="padding:20px 28px;border-top:1px solid #2a3540;font-size:12px;color:#7d838a">
        <p style="margin:0">contact@gamelyd.com &middot; www.gamelyd.com</p>
      </div>
    </div>
  </div>`;
}

function heading(text: string): string {
  return `<h2 style="color:#fff;font-size:18px;margin:0 0 12px">${text}</h2>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:18px;background:${BRAND};color:#04201e;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none">${label}</a>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EmailContent {
  subject: string;
  html: string;
}

export function registerEmail(name: string): EmailContent {
  return {
    subject: "Welcome To Gamelyd",
    html: layout(
      `${heading(`Welcome, ${name}!`)}
       <p>Your Gamelyd account is ready. Create a tournament, register teams, draw fixtures, and keep scores in one place.</p>
       ${button(env.appUrl, "Go to Gamelyd")}`,
    ),
  };
}

export function forgotPasswordEmail(token: string, name: string): EmailContent {
  return {
    subject: "Reset Password",
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>We received a request to reset your password. Click below to set a new one.</p>
       ${button(`${env.appUrl}/resetpassword/${token}`, "Reset Password")}
       <p style="margin-top:18px;font-size:12px">If you didn't request this, you can ignore this email.</p>`,
    ),
  };
}

export function passwordChangedEmail(name: string): EmailContent {
  return {
    subject: "Your Password Was Changed",
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>Your Gamelyd password was changed successfully. If this wasn't you, contact support immediately.</p>`,
    ),
  };
}

export function createTournamentEmail(name: string): EmailContent {
  return {
    subject: "New Tournament",
    html: layout(
      `${heading(`Nice one, ${name}!`)}
       <p>Your tournament has been created. Share it and start inviting players.</p>`,
    ),
  };
}

export function registerTournamentEmail(
  name: string,
  tournamentName: string,
  teamName: string,
  date: string,
  tournamentId: string,
): EmailContent {
  return {
    subject: "New Tournament",
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>Team <strong>${teamName}</strong> is registered for <strong>${tournamentName}</strong> on ${date}.</p>
       ${button(`${env.appUrl}/tournament/${tournamentId}`, "View Tournament")}`,
    ),
  };
}

export function tournamentInviteEmail(
  name: string,
  tournamentId: string,
  tournamentName: string,
): EmailContent {
  return {
    subject: `You are invited to ${tournamentName}`,
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>You have been invited to join <strong>${tournamentName}</strong> on Gamelyd. Accept the invite in the app, then register your team.</p>
       ${button(`${env.appUrl}/notifications`, "View invite")}`,
    ),
  };
}

export function teamInviteEmail(
  name: string,
  tournamentId: string,
  tournamentName: string,
  teamName: string,
): EmailContent {
  return {
    subject: `Join ${teamName} in ${tournamentName}`,
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>You have been invited to join team <strong>${teamName}</strong> in <strong>${tournamentName}</strong>. You are not on the roster until you accept.</p>
       ${button(`${env.appUrl}/notifications`, "Accept invite")}`,
    ),
  };
}

export function addTimeEmail(
  name: string,
  tournamentName: string,
  tournamentId: string,
  time: string,
  date: string,
): EmailContent {
  return {
    subject: "Tournament Time and Date",
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>Your match in <strong>${tournamentName}</strong> is scheduled for <strong>${date}</strong> at <strong>${time}</strong>.</p>
       ${button(`${env.appUrl}/tournament/${tournamentId}`, "View Fixture")}`,
    ),
  };
}

export function addLinkEmail(
  name: string,
  tournamentName: string,
  tournamentId: string,
): EmailContent {
  return {
    subject: "Link to join match is now available",
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>The link to join your match in <strong>${tournamentName}</strong> is now available.</p>
       ${button(`${env.appUrl}/tournament/${tournamentId}`, "Join Match")}`,
    ),
  };
}

export function drawMadeEmail(
  name: string,
  tournamentName: string,
  tournamentId: string,
  detail: string,
): EmailContent {
  return {
    subject: `Draw is out: ${tournamentName}`,
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>${detail}</p>
       ${button(`${env.appUrl}/tournament/${tournamentId}`, "View fixtures")}`,
    ),
  };
}

export function scorePostedEmail(
  name: string,
  tournamentName: string,
  tournamentId: string,
  detail: string,
): EmailContent {
  return {
    subject: `Score posted in ${tournamentName}`,
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>${detail}</p>
       ${button(`${env.appUrl}/tournament/${tournamentId}`, "View result")}`,
    ),
  };
}

export function announcementEmail(
  name: string,
  tournamentName: string,
  tournamentId: string,
  body: string,
): EmailContent {
  return {
    subject: `Update in ${tournamentName}`,
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>New announcement in <strong>${tournamentName}</strong>:</p>
       <p>${escapeHtml(body)}</p>
       ${button(`${env.appUrl}/tournament/${tournamentId}`, "Open tournament")}`,
    ),
  };
}

export function settingChangeEmail(
  name: string,
  tournamentName: string,
  tournamentId: string,
  summary: string,
): EmailContent {
  return {
    subject: `Setting change in ${tournamentName}`,
    html: layout(
      `${heading(`Hi ${name},`)}
       <p>The host wants to change how <strong>${tournamentName}</strong> runs:</p>
       <p><strong>${escapeHtml(summary)}</strong></p>
       <p>This only applies after everyone in the event accepts.</p>
       ${button(`${env.appUrl}/tournament/${tournamentId}`, "Review and accept")}`,
    ),
  };
}

export function contactOrAbuseEmail(
  name: string,
  message: string,
  fromEmail: string,
  isAbuse: boolean,
): EmailContent {
  return {
    subject: isAbuse ? "Abuse Report From Gamelyd" : "Contact From Gamelyd",
    html: layout(
      `${heading(isAbuse ? "New Abuse Report" : "New Contact Message")}
       <p><strong>From:</strong> ${name} (${fromEmail})</p>
       <p>${message}</p>`,
    ),
  };
}
