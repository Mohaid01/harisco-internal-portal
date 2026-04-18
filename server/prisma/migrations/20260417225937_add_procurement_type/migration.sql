-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Procurement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "estimatedCost" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Laptop',
    "status" TEXT NOT NULL DEFAULT 'PENDING_IT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Procurement" ("createdAt", "estimatedCost", "id", "item", "quantity", "requester", "status", "updatedAt") SELECT "createdAt", "estimatedCost", "id", "item", "quantity", "requester", "status", "updatedAt" FROM "Procurement";
DROP TABLE "Procurement";
ALTER TABLE "new_Procurement" RENAME TO "Procurement";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
