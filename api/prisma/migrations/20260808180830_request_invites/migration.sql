-- CreateTable
CREATE TABLE "_RequestInvites" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RequestInvites_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RequestInvites_B_index" ON "_RequestInvites"("B");

-- AddForeignKey
ALTER TABLE "_RequestInvites" ADD CONSTRAINT "_RequestInvites_A_fkey" FOREIGN KEY ("A") REFERENCES "marketplace_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequestInvites" ADD CONSTRAINT "_RequestInvites_B_fkey" FOREIGN KEY ("B") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
