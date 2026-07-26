package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// NotificationRepository provides SQL access to the notifications table.
type NotificationRepository struct {
	*Repository
}

// NewNotificationRepository creates a NotificationRepository bound to the
// given Repository.
func NewNotificationRepository(r *Repository) *NotificationRepository {
	return &NotificationRepository{Repository: r}
}

// NotificationRow is a notifications row.
type NotificationRow struct {
	ID               string
	UserID           string
	Type             string
	Message          string
	Read             bool
	RelatedMatchID   *string
	RelatedListingID *string
	CreatedAt        time.Time
}

const notificationColumns = `id, user_id, type, message, read, related_match_id, related_listing_id, created_at`

func scanNotification(row scannable) (NotificationRow, error) {
	var n NotificationRow
	err := row.Scan(
		&n.ID, &n.UserID, &n.Type, &n.Message, &n.Read,
		&n.RelatedMatchID, &n.RelatedListingID, &n.CreatedAt,
	)
	return n, err
}

// ListForUser returns every notification for a user, most recently created
// first.
func (r *NotificationRepository) ListForUser(ctx context.Context, userID string) ([]NotificationRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+notificationColumns+`
		FROM notifications WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []NotificationRow
	for rows.Next() {
		n, err := scanNotification(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// GetByID looks up a single notification by id. Returns ErrNotFound if no
// such notification exists.
func (r *NotificationRepository) GetByID(ctx context.Context, id string) (NotificationRow, error) {
	n, err := scanNotification(r.db.QueryRow(ctx, `
		SELECT `+notificationColumns+` FROM notifications WHERE id = $1
	`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return NotificationRow{}, ErrNotFound
	}
	if err != nil {
		return NotificationRow{}, err
	}
	return n, nil
}

// MarkRead sets read = true. Ownership must already be checked by the
// caller (see handlers.NotificationsHandler.MarkRead) — this just performs
// the write.
func (r *NotificationRepository) MarkRead(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `UPDATE notifications SET read = true WHERE id = $1`, id)
	return err
}
