import { useState, useMemo } from 'react';

interface UsePaginationProps<T> {
  items: T[] | undefined;
  itemsPerPage?: number;
}

export function usePagination<T>({ items, itemsPerPage = 10 }: UsePaginationProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    if (!items) return 0;
    return Math.ceil(items.length / itemsPerPage);
  }, [items, itemsPerPage]);

  const paginatedItems = useMemo(() => {
    if (!items) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    previousPage,
    totalItems: items?.length || 0,
  };
}
