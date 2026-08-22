-- CreateTable
CREATE TABLE "TemplateStaticText" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "xPercent" DOUBLE PRECISION NOT NULL,
    "yPercent" DOUBLE PRECISION NOT NULL,
    "widthPercent" DOUBLE PRECISION,
    "heightPercent" DOUBLE PRECISION,
    "fontSize" INTEGER NOT NULL,
    "fontFamily" TEXT,
    "fontColor" TEXT,
    "fontWeight" TEXT,
    "fontStyle" TEXT,
    "textDecoration" TEXT,
    "textAlign" TEXT NOT NULL DEFAULT 'left',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateStaticText_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateStaticText_templateId_idx" ON "TemplateStaticText"("templateId");

-- AddForeignKey
ALTER TABLE "TemplateStaticText" ADD CONSTRAINT "TemplateStaticText_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
