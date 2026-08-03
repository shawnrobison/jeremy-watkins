(function attachHomeServiceVisits(root) {
  function normalizeFollowUps(visit) {
    return Array.isArray(visit?.follow_ups) ? visit.follow_ups : [];
  }

  function countOpenFollowUps(visits) {
    return (Array.isArray(visits) ? visits : []).reduce((count, visit) => {
      return count + normalizeFollowUps(visit).filter((item) => item.status !== "done").length;
    }, 0);
  }

  function formatServiceVisitDate(iso) {
    if (!iso) return "Date unknown";

    return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getServiceVisitStatus(visit) {
    const status = visit?.status;
    if (status === "complete") return "ok";
    if (status === "blocked") return "urgent";
    return "soon";
  }

  const api = {
    countOpenFollowUps,
    formatServiceVisitDate,
    getServiceVisitStatus,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.HomeServiceVisits = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
