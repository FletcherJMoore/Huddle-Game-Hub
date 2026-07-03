// Central registry of DOM nodes for the redesigned app. Modules run as deferred
// ES modules, so the document is already parsed when these queries execute.

const $ = (id) => document.getElementById(id);

export const elements = {
  // screens
  authScreen: $("authScreen"),
  appRoot: $("appRoot"),
  dashboardScreen: $("dashboardScreen"),
  boardScreen: $("boardScreen"),

  // auth
  emailAuthForm: $("emailAuthForm"),
  authName: $("authName"),
  authEmail: $("authEmail"),
  authPassword: $("authPassword"),
  emailSignInButton: $("emailSignInButton"),
  emailSignUpButton: $("emailSignUpButton"),
  googleSignInButton: $("googleSignInButton"),
  authNotice: $("authNotice"),
  authError: $("authError"),

  // dashboard topbar
  newBoardButtonTop: $("newBoardButtonTop"),
  notifButton: $("notifButton"),
  notifBadge: $("notifBadge"),
  notifMenu: $("notifMenu"),
  notifList: $("notifList"),
  clearNotifsButton: $("clearNotifsButton"),
  profileButton: $("profileButton"),
  profileAvatar: $("profileAvatar"),
  profileMenu: $("profileMenu"),
  profileMenuAvatar: $("profileMenuAvatar"),
  profileMenuName: $("profileMenuName"),
  profileMenuEmail: $("profileMenuEmail"),
  signOutButton: $("signOutButton"),
  linkSteamButton: $("linkSteamButton"),
  enablePushButton: $("enablePushButton"),

  // dashboard body
  dashWelcome: $("dashWelcome"),
  needsSection: $("needsSection"),
  needsStrip: $("needsStrip"),
  needsCount: $("needsCount"),
  needsActions: $("needsActions"),
  upcomingList: $("upcomingList"),
  dashBoardCount: $("dashBoardCount"),
  boardCards: $("boardCards"),

  // rail
  railLogo: $("railLogo"),
  railBoards: $("railBoards"),
  railCreate: $("railCreate"),

  // board header
  boardEmoji: $("boardEmoji"),
  boardName: $("boardName"),
  boardOnline: $("boardOnline"),
  boardSubtitle: $("boardSubtitle"),
  headerAvatars: $("headerAvatars"),
  inviteButton: $("inviteButton"),
  boardSettingsButton: $("boardSettingsButton"),

  // tabs + views
  tabRoster: $("tabRoster"),
  tabSchedule: $("tabSchedule"),
  rosterView: $("rosterView"),
  scheduleView: $("scheduleView"),

  // roster
  rosterSubtitle: $("rosterSubtitle"),
  spinButton: $("spinButton"),
  proposeGameButton: $("proposeGameButton"),
  wheelResult: $("wheelResult"),
  rotationList: $("rotationList"),
  rotationCount: $("rotationCount"),
  pendingList: $("pendingList"),
  pendingCount: $("pendingCount"),
  rejectedList: $("rejectedList"),
  rejectedCount: $("rejectedCount"),
  steamLink: $("steamLink"),
  commonGames: $("commonGames"),
  commonCount: $("commonCount"),

  // schedule
  proposeTimeButton: $("proposeTimeButton"),
  heatmap: $("heatmap"),
  bestDayLabel: $("bestDayLabel"),
  sessionList: $("sessionList"),

  // chat
  chatPanel: $("chatPanel"),
  chatToggle: $("chatToggle"),
  chatOnline: $("chatOnline"),
  chatLog: $("chatLog"),
  chatForm: $("chatForm"),
  chatMessage: $("chatMessage"),
  quickPollButton: $("quickPollButton"),
  shareSessionButton: $("shareSessionButton"),

  // modals
  modalRoot: $("modalRoot"),
  modalProposeGame: $("modalProposeGame"),
  modalInvite: $("modalInvite"),
  modalProposeTime: $("modalProposeTime"),
  modalCreateBoard: $("modalCreateBoard"),

  // propose game
  proposeGameForm: $("proposeGameForm"),
  pgModalTitle: $("pgModalTitle"),
  pgSubmitButton: $("pgSubmitButton"),
  pgTitle: $("pgTitle"),
  pgVariant: $("pgVariant"),
  pgPlayers: $("pgPlayers"),
  pgPlatforms: $("pgPlatforms"),
  pgTags: $("pgTags"),
  pgSteamSearch: $("pgSteamSearch"),
  pgSteamSuggest: $("pgSteamSuggest"),
  pgSteamLinked: $("pgSteamLinked"),

  // invite
  inviteBoardName: $("inviteBoardName"),
  inviteForm: $("inviteForm"),
  inviteEmail: $("inviteEmail"),
  sendInviteButton: $("sendInviteButton"),
  inviteFeedback: $("inviteFeedback"),
  pendingInvites: $("pendingInvites"),

  // propose time
  proposeTimeForm: $("proposeTimeForm"),
  ptDate: $("ptDate"),
  ptStart: $("ptStart"),
  ptEnd: $("ptEnd"),
  ptLabel: $("ptLabel"),

  // create board
  createBoardForm: $("createBoardForm"),
  cbModalTitle: $("cbModalTitle"),
  cbSubmitButton: $("cbSubmitButton"),
  cbDeleteButton: $("cbDeleteButton"),
  cbEmoji: $("cbEmoji"),
  cbAccent: $("cbAccent"),
  cbName: $("cbName"),
  cbMembersSection: $("cbMembersSection"),
  cbMembers: $("cbMembers"),

  emptyTemplate: $("emptyTemplate")
};
