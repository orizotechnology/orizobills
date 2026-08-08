import { Search, Printer, X, Truck } from "lucide-react";

export default function ProductsPage() {
  return (
    <div className="w-full bg-white overflow-hidden">

      {/* Top light strip */}
      <div className="h-[12px] bg-[#f1f4ff]" />

      {/* =====================================================
          TOP ROW
      ====================================================== */}
      <div className="h-[54px] px-[16px] flex items-center">

        {/* Search icon outside */}
        <Search
          size={15}
          strokeWidth={1.7}
          className="mr-[10px] text-[#94a3b8] shrink-0"
        />

        {/* Search box */}
        <div className="w-[842px] h-[30px] flex items-center border border-[#cbd5e1] bg-white">

          <input
            type="text"
            placeholder="Search products..."
            className="
              ml-[10px]
              w-full
              h-full
              outline-none
              border-none
              bg-transparent
              text-[14px]
              font-normal
              text-[#64748b]
              placeholder:text-[#94a3b8]
            "
          />

        </div>

        {/* Top buttons */}
        <div className="ml-[24px] flex items-center gap-[11px]">

          <button
            className="
              h-[28px]
              px-[14px]
              rounded-[8px]
              bg-[#2563eb]
              text-white
              text-[13px]
              font-semibold
              whitespace-nowrap
            "
          >
            + Add Sale
          </button>

          <button
            className="
              h-[28px]
              px-[14px]
              rounded-[8px]
              bg-[#2563eb]
              text-white
              text-[13px]
              font-semibold
              whitespace-nowrap
            "
          >
            + Add Purchase
          </button>

          <button
            className="
              h-[28px]
              px-[14px]
              rounded-[8px]
              bg-[#16a34a]
              text-white
              text-[13px]
              font-semibold
              whitespace-nowrap
            "
          >
            + Add Item
          </button>

          <button className="w-[27px] h-[28px] flex items-center justify-center text-[#64748b]">
            <Printer size={16} strokeWidth={1.7} />
          </button>

          <button className="w-[25px] h-[28px] flex items-center justify-center text-[#94a3b8]">
            <X size={17} strokeWidth={1.7} />
          </button>

        </div>
      </div>

      {/* =====================================================
          TABS
      ====================================================== */}
      <div className="h-[46px] flex items-end border-b border-[#edf0f4]">

        {/* PRODUCTS */}
        <button
          className="
            ml-[24px]
            w-[72px]
            h-[32px]
            border-b-[px]
            border-[#2563eb]
            text-[#2563eb]
            text-[13px]
            font-semibold
            text-left
          "
        >
          PRODUCTS
        </button>

        {/* BIG GAP BETWEEN PRODUCTS AND UNITS */}
        <button
          className="
            ml-[72px]
            h-[32px]
            text-[#475569]
            text-[13px]
            font-semibold
          "
        >
          UNITS
        </button>

      </div>

      {/* =====================================================
          CONTENT
      ====================================================== */}
      <div className="relative h-[175px]">

        {/* =================================================
            LOWER SEARCH + ADD ITEM
        ================================================== */}
        <div
          className="
            absolute
            left-0
            top-[13px]
            h-[40px]
            flex
            items-center
          "
        >

          {/* Search icon */}
          <Search
            size={15}
            strokeWidth={1.7}
            className="
              ml-[18px]
              mr-[30px]
              text-[#94a3b8]
            "
          />

          {/* Add Item */}
          <button
            className="
              w-[230px]
              h-[29px]
              rounded-[8px]
              bg-[#16a34a]
              text-white
              text-[13px]
              font-semibold
            "
          >
            + Add Item
          </button>

        </div>

        {/* =================================================
            NO PRODUCTS
        ================================================== */}
        <p
          className="
            absolute
            left-[91px]
            top-[101px]
            m-0
            text-[14px]
            font-normal
            text-[#94a3b8]
          "
        >
          No products yet.
        </p>

        {/* =================================================
            RIGHT EMPTY STATE
        ================================================== */}
        <div
          className="
            absolute
            left-1/2
            top-[55px]
            w-1/2
            flex
            flex-col
            items-center
          "
        >

          <Truck
            size={48}
            strokeWidth={1.5}
            className="text-[#cbd5e1]"
          />

          <p
            className="
              mt-[12px]
              m-0
              text-[14px]
              font-normal
              text-[#94a3b8]
            "
          >
            Select a product to view details
          </p>

        </div>

      </div>

    </div>
  );
}