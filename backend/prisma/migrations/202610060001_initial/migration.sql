CREATE TABLE "Category" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "parentId" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Document" (
  "id" TEXT NOT NULL, "categoryId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "tags" TEXT[], "originalFilename" TEXT NOT NULL, "filePath" TEXT NOT NULL,
  "pdfPath" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "fileSize" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Admin" (
  "id" TEXT NOT NULL, "username" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Document_tags_idx" ON "Document" USING GIN ("tags");
CREATE INDEX "Document_categoryId_idx" ON "Document"("categoryId");
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
