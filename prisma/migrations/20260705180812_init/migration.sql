-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'DEPT_MANAGER', 'PURCHASER', 'DIRECTOR', 'ACCOUNTANT', 'WAREHOUSE', 'ADMIN');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "PrStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ApprovalEntityType" AS ENUM ('PR', 'PO', 'VENDOR', 'CONTRACT', 'INVOICE', 'PAYMENT_REQUEST', 'GOODS_ISSUE', 'STOCK_COUNT');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SENT', 'CLOSED', 'AWARDED');

-- CreateEnum
CREATE TYPE "PoStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GrnStatus" AS ENUM ('DRAFT', 'QC_PENDING', 'ACCEPTED', 'PARTIALLY_REJECTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'MISMATCH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PaymentRequestType" AS ENUM ('VENDOR_PAYMENT', 'ADVANCE', 'REIMBURSEMENT', 'ADVANCE_SETTLEMENT');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('GRN_IN', 'ISSUE_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUST_IN', 'ADJUST_OUT', 'RETURN_IN');

-- CreateEnum
CREATE TYPE "GoodsIssueStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ISSUED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'COUNTING', 'POSTED');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('SINGLE_SOURCE', 'NON_LOWEST_AWARD', 'TOLERANCE_OVERRIDE', 'OVER_BUDGET', 'URGENT', 'RETROSPECTIVE_PO', 'BANK_CHANGE', 'FEFO_OVERRIDE', 'EXPIRED_ISSUE');

-- CreateEnum
CREATE TYPE "FxSource" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "SignatureMeaning" AS ENUM ('AUTHORED', 'REVIEWED', 'APPROVED', 'REJECTED', 'VERIFIED', 'RECEIVED', 'ISSUED', 'COUNTED', 'PAID');

-- CreateEnum
CREATE TYPE "CooFormCode" AS ENUM ('FORM_E', 'FORM_D', 'FORM_AK', 'FORM_AJ', 'FORM_AANZ', 'EUR1', 'CPTPP', 'FORM_S', 'FORM_VK');

-- CreateEnum
CREATE TYPE "ShipmentDocType" AS ENUM ('CO', 'BL', 'AWB', 'INVOICE', 'PACKING_LIST', 'CQ', 'CA', 'MSDS', 'IMPORT_LICENSE', 'CUSTOMS_DECL');

-- CreateEnum
CREATE TYPE "ShipmentDocStatus" AS ENUM ('PENDING', 'RECEIVED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "BarcodeType" AS ENUM ('ITEM', 'LOT', 'LOCATION', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "BarcodeFormat" AS ENUM ('CODE128', 'QR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roles" "Role"[] DEFAULT ARRAY['REQUESTER']::"Role"[],
    "departmentId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "isChief" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePw" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "pwChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVn" TEXT NOT NULL,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVn" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "committedVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "spentVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVn" TEXT NOT NULL,
    "parentId" TEXT,
    "isCapex" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Uom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVn" TEXT NOT NULL,

    CONSTRAINT "Uom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVn" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "specDescription" TEXT,
    "lastPriceVnd" DECIMAL(18,2),
    "isLotTracked" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVn" TEXT NOT NULL,
    "taxCode" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankChangeFreeze" BOOLEAN NOT NULL DEFAULT false,
    "status" "VendorStatus" NOT NULL DEFAULT 'DRAFT',
    "rating" DECIMAL(4,2),
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coiNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorEvaluation" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "deliveryScore" INTEGER NOT NULL,
    "priceScore" INTEGER NOT NULL,
    "serviceScore" INTEGER NOT NULL,
    "overall" DECIMAL(4,2) NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL,
    "prNumber" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "neededByDate" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "projectCode" TEXT,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "status" "PrStatus" NOT NULL DEFAULT 'DRAFT',
    "totalEstimatedVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentApprovalLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrLine" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "itemId" TEXT,
    "freeTextDescription" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "uomId" TEXT NOT NULL,
    "estUnitPriceVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "budgetId" TEXT,
    "isCapex" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "PrLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalMatrix" (
    "id" TEXT NOT NULL,
    "entityType" "ApprovalEntityType" NOT NULL DEFAULT 'PR',
    "minAmountVnd" DECIMAL(18,2) NOT NULL,
    "maxAmountVnd" DECIMAL(18,2),
    "level" INTEGER NOT NULL,
    "approverRole" "Role",
    "approverUserId" TEXT,
    "departmentId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ApprovalMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "entityType" "ApprovalEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "snapshotHash" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "delegatedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "prId" TEXT,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqLine" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "uomId" TEXT,

    CONSTRAINT "RfqLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqVendor" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "RfqVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "quoteRef" TEXT,
    "validUntil" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER,
    "paymentTerms" TEXT,
    "totalVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "attachmentId" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "rfqLineId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "prId" TEXT,
    "quoteId" TEXT,
    "contractId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "paymentTerms" TEXT,
    "incoterm" TEXT,
    "incotermPlace" TEXT,
    "deliveryAddress" TEXT,
    "expectedDate" TIMESTAMP(3),
    "warrantyTerms" TEXT,
    "status" "PoStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vatPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "vatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dutyVnd" DECIMAL(18,2),
    "importVatVnd" DECIMAL(18,2),
    "freightVnd" DECIMAL(18,2),
    "handlingVnd" DECIMAL(18,2),
    "cooFormTypeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoLine" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "prLineId" TEXT,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "uomId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "invoicedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isCapex" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PoLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "GrnStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrnLine" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "poLineId" TEXT NOT NULL,
    "lotId" TEXT,
    "qtyReceived" DECIMAL(18,4) NOT NULL,
    "qtyAccepted" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qtyRejected" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "rejectReason" TEXT,

    CONSTRAINT "GrnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorInvoiceNo" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidDate" TIMESTAMP(3),
    "attachmentId" TEXT,
    "xmlPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "poLineId" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "valueVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "priceListJson" JSONB,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "renewalAlertDays" INTEGER NOT NULL DEFAULT 60,
    "attachmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "paymentRequestNumber" TEXT NOT NULL,
    "type" "PaymentRequestType" NOT NULL,
    "requesterId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "vendorId" TEXT,
    "payeeName" TEXT NOT NULL,
    "payeeBankName" TEXT,
    "payeeBankAccount" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "dueDate" TIMESTAMP(3),
    "reason" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "paidById" TEXT,
    "paymentRef" TEXT,
    "advanceRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequestLine" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "poId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PaymentRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameVn" TEXT NOT NULL,
    "address" TEXT,
    "keeperId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "qtyOnHand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "avgCostVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "movementNumber" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "unitCostVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refEntityType" TEXT,
    "refEntityId" TEXT,
    "scannedBarcodeId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsIssue" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "projectCode" TEXT,
    "purpose" TEXT NOT NULL,
    "status" "GoodsIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsIssueLine" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "qtyRequested" DECIMAL(18,4) NOT NULL,
    "qtyIssued" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uomId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "GoodsIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "countNumber" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "countDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotId" TEXT,
    "systemQty" DECIMAL(18,4) NOT NULL,
    "countedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "varianceQty" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemStockPolicy" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "minQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "maxQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorderQty" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "ItemStockPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "vendorId" TEXT,
    "grnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barcode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "BarcodeType" NOT NULL,
    "itemId" TEXT,
    "lotId" TEXT,
    "warehouseId" TEXT,
    "binCode" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "format" "BarcodeFormat" NOT NULL DEFAULT 'CODE128',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Barcode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionVn" TEXT NOT NULL,
    "uomCustoms" TEXT,
    "mfnDutyPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "vatImportPct" DECIMAL(6,3) NOT NULL DEFAULT 10,
    "notes" TEXT,

    CONSTRAINT "HsCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooFormType" (
    "id" TEXT NOT NULL,
    "code" "CooFormCode" NOT NULL,
    "agreementName" TEXT NOT NULL,
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferentialDutyNote" TEXT,

    CONSTRAINT "CooFormType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HsCodeDuty" (
    "id" TEXT NOT NULL,
    "hsCodeId" TEXT NOT NULL,
    "cooFormTypeId" TEXT NOT NULL,
    "preferentialDutyPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "conditions" TEXT,

    CONSTRAINT "HsCodeDuty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTrade" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "hsCodeId" TEXT NOT NULL,
    "originCountry" TEXT,
    "requiresImportLicense" BOOLEAN NOT NULL DEFAULT false,
    "licenseNote" TEXT,

    CONSTRAINT "ItemTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentDoc" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "type" "ShipmentDocType" NOT NULL,
    "cooFormTypeId" TEXT,
    "docNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "attachmentId" TEXT,
    "status" "ShipmentDocStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ShipmentDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandedCostEstimate" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "hsCodeId" TEXT NOT NULL,
    "originCountry" TEXT,
    "cooFormTypeId" TEXT,
    "incoterm" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "freightEst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "handlingEst" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dutyPct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "importVatPct" DECIMAL(6,3) NOT NULL DEFAULT 10,
    "landedUnitCostVnd" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandedCostEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "rateToVnd" DECIMAL(18,6) NOT NULL,
    "source" "FxSource" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicSignature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meaning" "SignatureMeaning" NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fullNamePrinted" TEXT NOT NULL,
    "reason" TEXT,
    "recordSnapshotHash" TEXT NOT NULL,
    "prevSignatureHash" TEXT,

    CONSTRAINT "ElectronicSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureFailure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "SignatureFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleVn" TEXT NOT NULL,
    "bodyEn" TEXT,
    "bodyVn" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_managerId_key" ON "Department"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- CreateIndex
CREATE INDEX "CostCenter_departmentId_idx" ON "CostCenter"("departmentId");

-- CreateIndex
CREATE INDEX "Budget_fiscalYear_idx" ON "Budget"("fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_costCenterId_fiscalYear_categoryId_key" ON "Budget"("costCenterId", "fiscalYear", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Uom_code_key" ON "Uom"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE INDEX "Item_categoryId_idx" ON "Item"("categoryId");

-- CreateIndex
CREATE INDEX "Item_isActive_idx" ON "Item"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_code_key" ON "Vendor"("code");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "VendorEvaluation_vendorId_idx" ON "VendorEvaluation"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_prNumber_key" ON "PurchaseRequisition"("prNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_status_idx" ON "PurchaseRequisition"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_requesterId_idx" ON "PurchaseRequisition"("requesterId");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_departmentId_idx" ON "PurchaseRequisition"("departmentId");

-- CreateIndex
CREATE INDEX "PrLine_prId_idx" ON "PrLine"("prId");

-- CreateIndex
CREATE INDEX "ApprovalMatrix_entityType_isActive_idx" ON "ApprovalMatrix"("entityType", "isActive");

-- CreateIndex
CREATE INDEX "ApprovalStep_entityType_entityId_idx" ON "ApprovalStep"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ApprovalStep_approverId_status_idx" ON "ApprovalStep"("approverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_rfqNumber_key" ON "Rfq"("rfqNumber");

-- CreateIndex
CREATE INDEX "Rfq_status_idx" ON "Rfq"("status");

-- CreateIndex
CREATE INDEX "RfqLine_rfqId_idx" ON "RfqLine"("rfqId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqVendor_rfqId_vendorId_key" ON "RfqVendor"("rfqId", "vendorId");

-- CreateIndex
CREATE INDEX "Quote_rfqId_idx" ON "Quote"("rfqId");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PoLine_poId_idx" ON "PoLine"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_grnNumber_key" ON "GoodsReceipt"("grnNumber");

-- CreateIndex
CREATE INDEX "GoodsReceipt_poId_idx" ON "GoodsReceipt"("poId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_status_idx" ON "GoodsReceipt"("status");

-- CreateIndex
CREATE INDEX "GrnLine_grnId_idx" ON "GrnLine"("grnId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_vendorId_idx" ON "Invoice"("vendorId");

-- CreateIndex
CREATE INDEX "Invoice_matchStatus_idx" ON "Invoice"("matchStatus");

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_vendorId_idx" ON "Contract"("vendorId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_paymentRequestNumber_key" ON "PaymentRequest"("paymentRequestNumber");

-- CreateIndex
CREATE INDEX "PaymentRequest_status_idx" ON "PaymentRequest"("status");

-- CreateIndex
CREATE INDEX "PaymentRequest_requesterId_idx" ON "PaymentRequest"("requesterId");

-- CreateIndex
CREATE INDEX "PaymentRequest_type_idx" ON "PaymentRequest"("type");

-- CreateIndex
CREATE INDEX "PaymentRequestLine_paymentRequestId_idx" ON "PaymentRequestLine"("paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "StockBalance_itemId_idx" ON "StockBalance"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_warehouseId_itemId_lotId_key" ON "StockBalance"("warehouseId", "itemId", "lotId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_movementNumber_key" ON "StockMovement"("movementNumber");

-- CreateIndex
CREATE INDEX "StockMovement_warehouseId_itemId_idx" ON "StockMovement"("warehouseId", "itemId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_postedAt_idx" ON "StockMovement"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsIssue_issueNumber_key" ON "GoodsIssue"("issueNumber");

-- CreateIndex
CREATE INDEX "GoodsIssue_status_idx" ON "GoodsIssue"("status");

-- CreateIndex
CREATE INDEX "GoodsIssue_warehouseId_idx" ON "GoodsIssue"("warehouseId");

-- CreateIndex
CREATE INDEX "GoodsIssueLine_issueId_idx" ON "GoodsIssueLine"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNumber_key" ON "StockTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status");

-- CreateIndex
CREATE INDEX "StockTransferLine_transferId_idx" ON "StockTransferLine"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_countNumber_key" ON "StockCount"("countNumber");

-- CreateIndex
CREATE INDEX "StockCount_warehouseId_idx" ON "StockCount"("warehouseId");

-- CreateIndex
CREATE INDEX "StockCountLine_countId_idx" ON "StockCountLine"("countId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemStockPolicy_itemId_warehouseId_key" ON "ItemStockPolicy"("itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "Lot_expiryDate_idx" ON "Lot"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_itemId_lotNumber_key" ON "Lot"("itemId", "lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Barcode_code_key" ON "Barcode"("code");

-- CreateIndex
CREATE INDEX "Barcode_type_idx" ON "Barcode"("type");

-- CreateIndex
CREATE UNIQUE INDEX "HsCode_code_key" ON "HsCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CooFormType_code_key" ON "CooFormType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "HsCodeDuty_hsCodeId_cooFormTypeId_key" ON "HsCodeDuty"("hsCodeId", "cooFormTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemTrade_itemId_key" ON "ItemTrade"("itemId");

-- CreateIndex
CREATE INDEX "ShipmentDoc_poId_idx" ON "ShipmentDoc"("poId");

-- CreateIndex
CREATE INDEX "LandedCostEstimate_itemId_idx" ON "LandedCostEstimate"("itemId");

-- CreateIndex
CREATE INDEX "Exception_type_idx" ON "Exception"("type");

-- CreateIndex
CREATE INDEX "Exception_entityType_entityId_idx" ON "Exception"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_currency_rateDate_key" ON "FxRate"("currency", "rateDate");

-- CreateIndex
CREATE INDEX "ElectronicSignature_entityType_entityId_idx" ON "ElectronicSignature"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ElectronicSignature_userId_idx" ON "ElectronicSignature"("userId");

-- CreateIndex
CREATE INDEX "SignatureFailure_userId_idx" ON "SignatureFailure"("userId");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_key_year_key" ON "Sequence"("key", "year");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "Uom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorEvaluation" ADD CONSTRAINT "VendorEvaluation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorEvaluation" ADD CONSTRAINT "VendorEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrLine" ADD CONSTRAINT "PrLine_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrLine" ADD CONSTRAINT "PrLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrLine" ADD CONSTRAINT "PrLine_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "Uom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrLine" ADD CONSTRAINT "PrLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_delegatedFromId_fkey" FOREIGN KEY ("delegatedFromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqVendor" ADD CONSTRAINT "RfqVendor_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqVendor" ADD CONSTRAINT "RfqVendor_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_rfqLineId_fkey" FOREIGN KEY ("rfqLineId") REFERENCES "RfqLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_cooFormTypeId_fkey" FOREIGN KEY ("cooFormTypeId") REFERENCES "CooFormType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoLine" ADD CONSTRAINT "PoLine_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoLine" ADD CONSTRAINT "PoLine_prLineId_fkey" FOREIGN KEY ("prLineId") REFERENCES "PrLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoLine" ADD CONSTRAINT "PoLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoLine" ADD CONSTRAINT "PoLine_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "Uom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrnLine" ADD CONSTRAINT "GrnLine_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrnLine" ADD CONSTRAINT "GrnLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PoLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrnLine" ADD CONSTRAINT "GrnLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "PoLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_advanceRequestId_fkey" FOREIGN KEY ("advanceRequestId") REFERENCES "PaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestLine" ADD CONSTRAINT "PaymentRequestLine_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestLine" ADD CONSTRAINT "PaymentRequestLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_keeperId_fkey" FOREIGN KEY ("keeperId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssue" ADD CONSTRAINT "GoodsIssue_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssue" ADD CONSTRAINT "GoodsIssue_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssue" ADD CONSTRAINT "GoodsIssue_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssue" ADD CONSTRAINT "GoodsIssue_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssue" ADD CONSTRAINT "GoodsIssue_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssueLine" ADD CONSTRAINT "GoodsIssueLine_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "GoodsIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssueLine" ADD CONSTRAINT "GoodsIssueLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssueLine" ADD CONSTRAINT "GoodsIssueLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssueLine" ADD CONSTRAINT "GoodsIssueLine_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "Uom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemStockPolicy" ADD CONSTRAINT "ItemStockPolicy_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemStockPolicy" ADD CONSTRAINT "ItemStockPolicy_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsCodeDuty" ADD CONSTRAINT "HsCodeDuty_hsCodeId_fkey" FOREIGN KEY ("hsCodeId") REFERENCES "HsCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HsCodeDuty" ADD CONSTRAINT "HsCodeDuty_cooFormTypeId_fkey" FOREIGN KEY ("cooFormTypeId") REFERENCES "CooFormType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTrade" ADD CONSTRAINT "ItemTrade_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTrade" ADD CONSTRAINT "ItemTrade_hsCodeId_fkey" FOREIGN KEY ("hsCodeId") REFERENCES "HsCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentDoc" ADD CONSTRAINT "ShipmentDoc_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentDoc" ADD CONSTRAINT "ShipmentDoc_cooFormTypeId_fkey" FOREIGN KEY ("cooFormTypeId") REFERENCES "CooFormType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostEstimate" ADD CONSTRAINT "LandedCostEstimate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostEstimate" ADD CONSTRAINT "LandedCostEstimate_hsCodeId_fkey" FOREIGN KEY ("hsCodeId") REFERENCES "HsCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostEstimate" ADD CONSTRAINT "LandedCostEstimate_cooFormTypeId_fkey" FOREIGN KEY ("cooFormTypeId") REFERENCES "CooFormType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostEstimate" ADD CONSTRAINT "lce_po_fk" FOREIGN KEY ("entityId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandedCostEstimate" ADD CONSTRAINT "LandedCostEstimate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureFailure" ADD CONSTRAINT "SignatureFailure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
