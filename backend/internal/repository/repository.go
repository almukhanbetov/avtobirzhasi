// Package repository contains SQL queries, one file per table, added
// starting Stage 1. Repository holds the shared connection pool they all
// use.
package repository

import "github.com/jackc/pgx/v5/pgxpool"

// Repository is embedded (or composed) by per-resource repositories added
// from Stage 1 onward.
type Repository struct {
	db *pgxpool.Pool
}

// New creates a Repository bound to the given connection pool.
func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}
