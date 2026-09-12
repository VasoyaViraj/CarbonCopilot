-- Phase 2 domain model: enums, AI history, simulation readings, indexes, cascades.
-- WARNING: users.role, activities.source and recommendations.status are recreated as enums
-- (existing values in those columns are dropped) and users.organization_id becomes NOT NULL.
-- Written for a database with no rows in these tables (the state after 20260912000000_init).

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FACTORY_OPERATOR', 'CONSULTANT', 'REGULATOR');

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('MANUAL', 'CSV', 'SIMULATION');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('NORMAL', 'ALERT');

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "processes" DROP CONSTRAINT "processes_factory_id_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_process_id_fkey";

-- DropForeignKey
ALTER TABLE "emissions" DROP CONSTRAINT "emissions_activity_id_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_factory_id_fkey";

-- DropForeignKey
ALTER TABLE "waste" DROP CONSTRAINT "waste_factory_id_fkey";

-- DropForeignKey
ALTER TABLE "waste" DROP CONSTRAINT "waste_process_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendations" DROP CONSTRAINT "recommendations_factory_id_fkey";

-- DropForeignKey
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_factory_id_fkey";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'FACTORY_OPERATOR';

-- AlterTable
ALTER TABLE "factories" ADD COLUMN     "industry_type" TEXT;

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "source",
ADD COLUMN     "source" "ActivitySource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "emission_factors" ADD COLUMN     "co2e_unit" TEXT NOT NULL DEFAULT 'kgCO2e';

-- AlterTable
ALTER TABLE "recommendations" DROP COLUMN "status",
ADD COLUMN     "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "factory_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_used" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_readings" (
    "id" SERIAL NOT NULL,
    "process_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" DOUBLE PRECISION,
    "energy_consumption" DOUBLE PRECISION,
    "fuel_consumption" DOUBLE PRECISION,
    "estimated_emission" DOUBLE PRECISION,
    "status" "SimulationStatus" NOT NULL DEFAULT 'NORMAL',
    "is_simulated" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "simulation_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");

-- CreateIndex
CREATE INDEX "ai_conversations_factory_id_idx" ON "ai_conversations"("factory_id");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "simulation_readings_process_id_timestamp_idx" ON "simulation_readings"("process_id", "timestamp");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "factories_organization_id_idx" ON "factories"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "processes_factory_id_name_key" ON "processes"("factory_id", "name");

-- CreateIndex
CREATE INDEX "activities_process_id_activity_date_idx" ON "activities"("process_id", "activity_date");

-- CreateIndex
CREATE INDEX "emission_factors_category_fuel_type_unit_idx" ON "emission_factors"("category", "fuel_type", "unit");

-- CreateIndex
CREATE INDEX "emissions_activity_id_idx" ON "emissions"("activity_id");

-- CreateIndex
CREATE INDEX "emissions_emission_factor_id_idx" ON "emissions"("emission_factor_id");

-- CreateIndex
CREATE INDEX "materials_factory_id_idx" ON "materials"("factory_id");

-- CreateIndex
CREATE INDEX "waste_factory_id_idx" ON "waste"("factory_id");

-- CreateIndex
CREATE INDEX "waste_process_id_idx" ON "waste"("process_id");

-- CreateIndex
CREATE INDEX "circular_alternatives_category_idx" ON "circular_alternatives"("category");

-- CreateIndex
CREATE UNIQUE INDEX "circular_alternatives_current_option_alternative_option_key" ON "circular_alternatives"("current_option", "alternative_option");

-- CreateIndex
CREATE INDEX "recommendations_factory_id_idx" ON "recommendations"("factory_id");

-- CreateIndex
CREATE INDEX "recommendations_process_id_idx" ON "recommendations"("process_id");

-- CreateIndex
CREATE INDEX "recommendations_alternative_id_idx" ON "recommendations"("alternative_id");

-- CreateIndex
CREATE INDEX "scenarios_factory_id_idx" ON "scenarios"("factory_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emissions" ADD CONSTRAINT "emissions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste" ADD CONSTRAINT "waste_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste" ADD CONSTRAINT "waste_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_readings" ADD CONSTRAINT "simulation_readings_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

