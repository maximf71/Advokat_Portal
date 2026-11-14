SELECT (SELECT COUNT(*) FROM "Lawyer") AS lawyers, (SELECT COUNT(*) FROM "CourtCase") AS cases, (SELECT COUNT(*) FROM "City") AS cities;
