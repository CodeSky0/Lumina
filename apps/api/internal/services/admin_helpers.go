package services

import (
	cryptorand "crypto/rand"
	"errors"
)

func cryptoRandRead(buffer []byte) (int, error) { return cryptorand.Read(buffer) }
func errorsAs(err error, target any) bool       { return errors.As(err, target) }
